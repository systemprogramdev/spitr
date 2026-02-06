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

    const { recipientId, amount } = await request.json()

    if (!recipientId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount < 1 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('transfer_spits', {
      p_sender_id: user.id,
      p_recipient_id: recipientId,
      p_amount: amount,
    })

    if (error) {
      console.error('Transfer RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as {
      success: boolean
      error?: string
      new_sender_balance?: number
      hp_penalty?: number
      new_hp?: number
      sent_today?: number
      received_today?: number
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Transfer failed' }, { status: 400 })
    }

    // Notify recipient
    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'transfer',
      actor_id: user.id,
      reference_id: amount.toString(),
    })

    return NextResponse.json({
      success: true,
      newBalance: result.new_sender_balance,
      hpPenalty: result.hp_penalty || 0,
      newHp: result.new_hp,
    })
  } catch (error) {
    console.error('Transfer error:', error)
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 })
  }
}
