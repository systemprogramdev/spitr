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

  let event: Stripe.Event

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
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

      // Check if this payment was already processed (idempotency)
      const { data: existingTransaction } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('reference_id', referenceId)
        .single()

      if (existingTransaction) {
        // Already processed by confirm-payment endpoint
        console.log(`Payment ${referenceId} already processed, skipping webhook`)
        return NextResponse.json({ received: true, alreadyProcessed: true })
      }

      // Atomic balance update using RPC to avoid TOCTOU race conditions
      const { data: updated, error: rpcError } = await supabase.rpc('increment_balance', {
        table_name: 'user_credits',
        user_id_param: userId,
        amount_param: creditsAmount,
      })

      let newBalance: number
      if (rpcError) {
        // Fallback: read-then-write
        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .single()

        const currentBalance = currentCredits?.balance || 0
        newBalance = currentBalance + creditsAmount

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
      } else {
        newBalance = (updated as number) || 0
      }

      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'purchase',
        amount: creditsAmount,
        balance_after: newBalance,
        reference_id: referenceId,
      })

      console.log(`Webhook: Added ${creditsAmount} credits to user ${userId}. New balance: ${newBalance}`)
    }
  }

  return NextResponse.json({ received: true })
}
