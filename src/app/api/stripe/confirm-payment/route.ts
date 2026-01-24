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
  try {
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing paymentIntentId' },
        { status: 400 }
      )
    }

    // Verify the payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    const { userId, credits } = paymentIntent.metadata

    if (!userId || !credits) {
      return NextResponse.json(
        { error: 'Invalid payment metadata' },
        { status: 400 }
      )
    }

    const creditsAmount = parseInt(credits, 10)

    // Check if this payment was already processed (idempotency)
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', paymentIntentId)
      .single()

    if (existingTransaction) {
      // Already processed, return success without duplicating
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single()

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        newBalance: currentCredits?.balance || 0,
      })
    }

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
      return NextResponse.json(
        { error: 'Failed to update credits' },
        { status: 500 }
      )
    }

    // Log the transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: creditsAmount,
      balance_after: newBalance,
      reference_id: paymentIntentId,
    })

    console.log(`Added ${creditsAmount} credits to user ${userId}. New balance: ${newBalance}`)

    return NextResponse.json({
      success: true,
      newBalance,
      creditsAdded: creditsAmount,
    })
  } catch (error) {
    console.error('Confirm payment error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
