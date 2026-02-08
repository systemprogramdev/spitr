import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOLD_DAILY_LIMIT = 10

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

    // Check daily gold send limit
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: sentData } = await supabaseAdmin
      .from('gold_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'transfer_sent')
      .gte('created_at', cutoff)

    const goldSentToday = sentData?.reduce((sum, t) => sum + Math.abs(t.amount), 0) ?? 0

    if (goldSentToday + amount > GOLD_DAILY_LIMIT) {
      const remaining = Math.max(0, GOLD_DAILY_LIMIT - goldSentToday)
      return NextResponse.json({
        error: `Daily gold transfer limit is ${GOLD_DAILY_LIMIT}. You've sent ${goldSentToday} today${remaining > 0 ? `, ${remaining} remaining` : ''}.`,
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('transfer_gold', {
      p_sender_id: user.id,
      p_recipient_id: recipientId,
      p_amount: amount,
    })

    if (error) {
      console.error('Gold transfer RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as {
      success: boolean
      error?: string
      new_sender_balance?: number
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Transfer failed' }, { status: 400 })
    }

    // Notify recipient
    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'transfer',
      actor_id: user.id,
      reference_id: `gold:${amount}`,
    })

    return NextResponse.json({
      success: true,
      newBalance: result.new_sender_balance,
    })
  } catch (error) {
    console.error('Gold transfer error:', error)
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 })
  }
}
