import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP, rejectSybil } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    const body = await request.json()
    const cdId = body.cd_id || body.cdId

    if (!cdId) {
      return NextResponse.json({ error: 'Missing cd_id' }, { status: 400 })
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
  } catch (err) {
    console.error('Bot CD redeem error:', err)
    return NextResponse.json({ error: 'CD redeem failed' }, { status: 500 })
  }
}
