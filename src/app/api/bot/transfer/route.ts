import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { bot, botUserId } = context

  try {
    const { recipientId, amount } = await request.json()

    if (!recipientId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount < 1 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Skip limits when bot sends to its owner
    const skipLimits = recipientId === bot.owner_id

    const { data, error: rpcErr } = await supabaseAdmin.rpc('transfer_spits', {
      p_sender_id: botUserId,
      p_recipient_id: recipientId,
      p_amount: amount,
      p_skip_limits: skipLimits,
    })

    if (rpcErr) {
      console.error('Bot transfer RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const result = data as {
      success: boolean
      error?: string
      new_sender_balance?: number
      hp_penalty?: number
      new_hp?: number
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Transfer failed' }, { status: 400 })
    }

    // Notify recipient
    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'transfer',
      actor_id: botUserId,
      reference_id: amount.toString(),
    })

    awardBotXP(botUserId, 'transfer')

    return NextResponse.json({
      success: true,
      newBalance: result.new_sender_balance,
      hpPenalty: result.hp_penalty || 0,
      newHp: result.new_hp,
    })
  } catch (err) {
    console.error('Bot transfer error:', err)
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 })
  }
}
