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

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // For development without webhook secret, we'll process all events
  // In production, you should verify the webhook signature
  let event: Stripe.Event

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } else {
      // Development mode - parse event directly
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle both checkout.session.completed and payment_intent.succeeded
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    let userId: string | undefined
    let credits: string | undefined
    let referenceId: string

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      userId = session.metadata?.userId
      credits = session.metadata?.credits
      referenceId = session.id
    } else {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      userId = paymentIntent.metadata?.userId
      credits = paymentIntent.metadata?.credits
      referenceId = paymentIntent.id
    }

    if (userId && credits) {
      const creditsAmount = parseInt(credits, 10)

      // Get current balance
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single()

      const currentBalance = currentCredits?.balance || 0
      const newBalance = currentBalance + creditsAmount

      // Update user credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })

      if (updateError) {
        console.error('Failed to update credits:', updateError)
        return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
      }

      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'purchase',
        amount: creditsAmount,
        balance_after: newBalance,
        reference_id: referenceId,
      })

      console.log(`Added ${creditsAmount} credits to user ${userId}. New balance: ${newBalance}`)
    }
  }

  return NextResponse.json({ received: true })
}
