import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const body = await request.json()
    const recipientId = body.target_user_id || body.recipientId
    const amount = body.amount

    if (!recipientId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount < 1 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data, error: rpcErr } = await supabaseAdmin.rpc('transfer_gold', {
      p_sender_id: botUserId,
      p_recipient_id: recipientId,
      p_amount: amount,
    })

    if (rpcErr) {
      console.error('Bot gold transfer RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const result = data as { success: boolean; error?: string; new_sender_balance?: number }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Transfer failed' }, { status: 400 })
    }

    // Notify recipient
    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'transfer',
      actor_id: botUserId,
      reference_id: `gold:${amount}`,
    })

    awardBotXP(botUserId, 'transfer')

    return NextResponse.json({
      success: true,
      new_balance: result.new_sender_balance,
    })
  } catch (err) {
    console.error('Bot gold transfer error:', err)
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 })
  }
}
