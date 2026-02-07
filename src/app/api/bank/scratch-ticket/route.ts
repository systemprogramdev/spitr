import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

    const { ticketId } = await request.json()

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('bank_scratch_ticket', {
      p_user_id: user.id,
      p_ticket_id: ticketId,
    })

    if (error) {
      console.error('Scratch ticket RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      isWinner: data.is_winner,
      prizeAmount: data.prize_amount,
      prizeCurrency: data.prize_currency,
    })
  } catch (error) {
    console.error('Scratch ticket error:', error)
    return NextResponse.json({ error: 'Scratch failed' }, { status: 500 })
  }
}
