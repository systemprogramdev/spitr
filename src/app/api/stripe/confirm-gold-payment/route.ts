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

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    const { userId, gold } = paymentIntent.metadata

    if (!userId || !gold) {
      return NextResponse.json(
        { error: 'Invalid payment metadata' },
        { status: 400 }
      )
    }

    const goldAmount = parseInt(gold, 10)

    // Check if already processed (idempotency)
    const { data: existingTransaction } = await supabase
      .from('gold_transactions')
      .select('id')
      .eq('reference_id', paymentIntentId)
      .single()

    if (existingTransaction) {
      const { data: currentGold } = await supabase
        .from('user_gold')
        .select('balance')
        .eq('user_id', userId)
        .single()

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        newBalance: currentGold?.balance || 0,
      })
    }

    // Atomic balance update using RPC to avoid TOCTOU race conditions
    const { data: updated, error: updateError } = await supabase.rpc('increment_balance', {
      table_name: 'user_gold',
      user_id_param: userId,
      amount_param: goldAmount,
    })

    // Fallback: if RPC doesn't exist, use read-then-write
    let newBalance: number
    if (updateError) {
      const { data: currentGold } = await supabase
        .from('user_gold')
        .select('balance')
        .eq('user_id', userId)
        .single()

      const currentBalance = currentGold?.balance || 0
      newBalance = currentBalance + goldAmount

      const { error: upsertError } = await supabase
        .from('user_gold')
        .upsert({
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('Failed to update gold:', upsertError)
        return NextResponse.json(
          { error: 'Failed to update gold balance' },
          { status: 500 }
        )
      }
    } else {
      newBalance = (updated as number) || 0
    }

    // Log the transaction
    await supabase.from('gold_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: goldAmount,
      balance_after: newBalance,
      reference_id: paymentIntentId,
    })

    return NextResponse.json({
      success: true,
      newBalance,
      goldAdded: goldAmount,
    })
  } catch (error) {
    console.error('Confirm gold payment error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
