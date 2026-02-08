import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const body = await request.json()
    const ticketId = body.ticketId || body.ticket_id

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400 })
    }

    const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_scratch_ticket', {
      p_user_id: botUserId,
      p_ticket_id: ticketId,
    })

    if (rpcErr) {
      console.error('Bot scratch ticket RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    awardBotXP(botUserId, 'ticket_scratch')

    return NextResponse.json({
      success: true,
      isWinner: data.is_winner,
      prizeAmount: data.prize_amount,
      prizeCurrency: data.prize_currency,
    })
  } catch (err) {
    console.error('Bot scratch error:', err)
    return NextResponse.json({ error: 'Scratch failed' }, { status: 500 })
  }
}
