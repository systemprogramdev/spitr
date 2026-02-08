import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'
import { CD_TIERS } from '@/lib/bank'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const body = await request.json()
    const action = body.action || 'buy' // 'buy' or 'redeem'

    if (action === 'buy') {
      const currency = body.currency || 'spit'
      const amount = body.amount
      const termDays = body.termDays || body.term_days || body.term

      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
      }

      if (currency !== 'spit' && currency !== 'gold') {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
      }

      const tier = CD_TIERS.find(t => t.termDays === termDays)
      if (!tier) {
        return NextResponse.json({ error: 'Invalid term. Use 7 or 30' }, { status: 400 })
      }

      const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_buy_cd', {
        p_user_id: botUserId,
        p_currency: currency,
        p_amount: Math.floor(amount),
        p_term_days: termDays,
        p_rate: tier.rate,
      })

      if (rpcErr) {
        console.error('Bot buy CD RPC error:', rpcErr)
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }

      awardBotXP(botUserId, 'cd_buy')

      return NextResponse.json({
        success: true,
        cdId: data.cd_id,
        maturesAt: data.matures_at,
        newWalletBalance: data.new_wallet_balance,
      })

    } else if (action === 'redeem') {
      const cdId = body.cdId || body.cd_id

      if (!cdId) {
        return NextResponse.json({ error: 'Missing CD ID' }, { status: 400 })
      }

      const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_redeem_cd', {
        p_user_id: botUserId,
        p_cd_id: cdId,
      })

      if (rpcErr) {
        console.error('Bot redeem CD RPC error:', rpcErr)
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }

      awardBotXP(botUserId, 'cd_redeem')

      return NextResponse.json({
        success: true,
        principal: data.principal,
        bonus: data.bonus,
        payout: data.payout,
        newWalletBalance: data.new_wallet_balance,
      })

    } else {
      return NextResponse.json({ error: 'Invalid action. Use buy or redeem' }, { status: 400 })
    }
  } catch (err) {
    console.error('Bot CD error:', err)
    return NextResponse.json({ error: 'CD operation failed' }, { status: 500 })
  }
}
