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

// Credit packages
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

    const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]
    if (!pkg) {
      return NextResponse.json(
        { error: 'Invalid package' },
        { status: 400 }
      )
    }

    // Get user email from Supabase
    const { data: userData } = await supabase
      .from('users')
      .select('handle')
      .eq('id', userId)
      .single()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${pkg.name} - ${pkg.credits} Spits`,
              description: `Get ${pkg.credits} spits to post, reply, respit, and promote on SPITr`,
              images: ['https://via.placeholder.com/300x300.png?text=SPITr+Credits'],
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/shop?success=true&credits=${pkg.credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/shop?canceled=true`,
      metadata: {
        userId,
        packageId,
        credits: pkg.credits.toString(),
        userHandle: userData?.handle || 'unknown',
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
