import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Credit packages - must match frontend
const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 199, name: 'Starter Pack' },
  popular: { credits: 500, price: 799, name: 'Popular Pack' },
  mega: { credits: 1500, price: 1999, name: 'Mega Pack' },
  whale: { credits: 5000, price: 4999, name: 'Whale Pack' },
}

export async function POST(request: NextRequest) {
  try {
    const { packageId, userId } = await request.json()

    if (!packageId || !userId) {
      return NextResponse.json(
        { error: 'Missing packageId or userId' },
        { status: 400 }
      )
    }

    // Validate userId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      )
    }

    const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]
    if (!pkg) {
      return NextResponse.json(
        { error: 'Invalid package' },
        { status: 400 }
      )
    }

    // Get user email from Supabase auth
    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const userEmail = userData?.user?.email

    // Create a PaymentIntent with all production requirements
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
        packageId,
        credits: pkg.credits.toString(),
        productName: pkg.name,
      },
      description: `SPITr ${pkg.name} - ${pkg.credits} Spits`,
      statement_descriptor_suffix: 'SPITR',
      ...(userEmail && { receipt_email: userEmail }),
    }, {
      // Idempotency key prevents duplicate charges if request is retried
      idempotencyKey: `pi_${userId}_${packageId}_${Date.now()}`,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Stripe payment intent error:', error)

    // Return more specific error for Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
