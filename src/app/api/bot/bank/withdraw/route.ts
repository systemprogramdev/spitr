import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { currency, amount } = await request.json()

    if (!currency || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (currency !== 'spit' && currency !== 'gold') {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_withdraw', {
      p_user_id: botUserId,
      p_currency: currency,
      p_amount: Math.floor(amount),
    })

    if (rpcErr) {
      console.error('Bot bank withdraw RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      withdrawn: data.withdrawn,
      newWalletBalance: data.new_wallet_balance,
    })
  } catch (err) {
    console.error('Bot bank withdraw error:', err)
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 })
  }
}
