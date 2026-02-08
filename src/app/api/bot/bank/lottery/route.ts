import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { TICKET_MAP, rollTicketOutcome } from '@/lib/bank'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const body = await request.json()
    const ticketType = body.ticketType || body.ticket_type || body.type

    const tier = TICKET_MAP.get(ticketType)
    if (!tier) {
      return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
    }

    const outcome = rollTicketOutcome(ticketType)

    const { data, error: rpcErr } = await supabaseAdmin.rpc('bank_buy_ticket', {
      p_user_id: botUserId,
      p_ticket_type: ticketType,
      p_cost: tier.cost,
      p_currency: tier.currency,
      p_is_winner: outcome.isWinner,
      p_prize_amount: outcome.prizeAmount,
    })

    if (rpcErr) {
      console.error('Bot buy ticket RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ticketId: data.ticket_id,
      cost: tier.cost,
      currency: tier.currency,
    })
  } catch (err) {
    console.error('Bot lottery error:', err)
    return NextResponse.json({ error: 'Ticket purchase failed' }, { status: 500 })
  }
}
