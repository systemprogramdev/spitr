import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

const GOLD_PACKAGES: Record<string, { gold: number; price: number; name: string }> = {
  gold_100: { gold: 100, price: 199, name: '100 Gold' },
  gold_500: { gold: 500, price: 799, name: '500 Gold' },
  gold_1500: { gold: 1500, price: 1999, name: '1,500 Gold' },
  gold_5000: { gold: 5000, price: 4999, name: '5,000 Gold' },
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      )
    }

    const pkg = GOLD_PACKAGES[packageId]
    if (!pkg) {
      return NextResponse.json(
        { error: 'Invalid package' },
        { status: 400 }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
        packageId,
        gold: pkg.gold.toString(),
        productName: pkg.name,
        type: 'gold',
      },
      description: `SPITr ${pkg.name}`,
      statement_descriptor_suffix: 'SPITR GOLD',
    }, {
      idempotencyKey: `gpi_${userId}_${packageId}_${Date.now()}`,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Stripe gold payment intent error:', error)

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
