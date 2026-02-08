import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'
import { getCurrentDailyRate } from '@/lib/bank'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const body = await request.json()
    const currency = body.currency || 'spit'
    const amount = body.amount

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (currency !== 'spit' && currency !== 'gold') {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    const lockedRate = getCurrentDailyRate()

    const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_deposit', {
      p_user_id: botUserId,
      p_currency: currency,
      p_amount: Math.floor(amount),
      p_locked_rate: lockedRate,
    })

    if (rpcErr) {
      console.error('Bot bank deposit RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    awardBotXP(botUserId, 'bank_deposit')

    return NextResponse.json({
      success: true,
      newWalletBalance: data.new_wallet_balance,
      deposited: data.deposited,
      lockedRate,
    })
  } catch (err) {
    console.error('Bot bank deposit error:', err)
    return NextResponse.json({ error: 'Deposit failed' }, { status: 500 })
  }
}
