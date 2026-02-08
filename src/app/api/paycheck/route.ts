import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCurrentDailyRate } from '@/lib/bank'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEEKLY_FREE_CREDITS = 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check eligibility server-side
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance, free_credits_at')
      .eq('user_id', user.id)
      .single()

    if (!credits) {
      return NextResponse.json({ error: 'No credits record' }, { status: 400 })
    }

    const lastFreeCredits = credits.free_credits_at
      ? new Date(credits.free_credits_at).getTime()
      : 0
    const now = Date.now()

    if (now - lastFreeCredits < SEVEN_DAYS_MS) {
      return NextResponse.json({ error: 'Not eligible yet' }, { status: 400 })
    }

    // Step A: Temporarily add 1000 to wallet (bank_deposit will deduct it)
    const tempBalance = credits.balance + WEEKLY_FREE_CREDITS
    await supabaseAdmin
      .from('user_credits')
      .update({
        balance: tempBalance,
        free_credits_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    // Step B: Deposit to bank (deducts from wallet, creates bank deposit)
    const lockedRate = getCurrentDailyRate()
    const { data: depositResult, error: depositErr } = await supabaseAdmin.rpc('bank_deposit', {
      p_user_id: user.id,
      p_currency: 'spit',
      p_amount: WEEKLY_FREE_CREDITS,
      p_locked_rate: lockedRate,
    })

    if (depositErr) {
      // Rollback: remove the temp credits
      await supabaseAdmin
        .from('user_credits')
        .update({ balance: credits.balance })
        .eq('user_id', user.id)
      console.error('Paycheck bank deposit error:', depositErr)
      return NextResponse.json({ error: 'Bank deposit failed' }, { status: 500 })
    }

    // Log transaction
    await supabaseAdmin.from('credit_transactions').insert({
      user_id: user.id,
      type: 'free_weekly',
      amount: WEEKLY_FREE_CREDITS,
      balance_after: depositResult.new_wallet_balance,
    })

    return NextResponse.json({
      success: true,
      amount: WEEKLY_FREE_CREDITS,
      lockedRate,
    })
  } catch (error) {
    console.error('Paycheck error:', error)
    return NextResponse.json({ error: 'Paycheck failed' }, { status: 500 })
  }
}
