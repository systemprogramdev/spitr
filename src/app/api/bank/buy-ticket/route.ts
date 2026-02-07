import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { TICKET_MAP, rollTicketOutcome } from '@/lib/bank'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticketType } = await request.json()

    const tier = TICKET_MAP.get(ticketType)
    if (!tier) {
      return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
    }

    // Roll outcome server-side
    const outcome = rollTicketOutcome(ticketType)

    const { data, error } = await supabaseAdmin.rpc('bank_buy_ticket', {
      p_user_id: user.id,
      p_ticket_type: ticketType,
      p_cost: tier.cost,
      p_currency: tier.currency,
      p_is_winner: outcome.isWinner,
      p_prize_amount: outcome.prizeAmount,
    })

    if (error) {
      console.error('Buy ticket RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ticketId: data.ticket_id,
    })
  } catch (error) {
    console.error('Buy ticket error:', error)
    return NextResponse.json({ error: 'Ticket purchase failed' }, { status: 500 })
  }
}
