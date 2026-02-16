import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYBIL_COST_GOLD = 1000

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a sybil server
    const { data: existing } = await supabaseAdmin
      .from('sybil_servers')
      .select('id, status')
      .eq('owner_user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You already have a Sybil Server', server: existing }, { status: 409 })
    }

    // Check gold balance
    const { data: gold } = await supabaseAdmin
      .from('user_gold')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (!gold || gold.balance < SYBIL_COST_GOLD) {
      return NextResponse.json(
        { success: false, error: `Insufficient gold (need ${SYBIL_COST_GOLD}, have ${gold?.balance ?? 0})` },
        { status: 402 }
      )
    }

    // Deduct gold
    const newBalance = gold.balance - SYBIL_COST_GOLD
    const { error: deductErr } = await supabaseAdmin
      .from('user_gold')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (deductErr) {
      return NextResponse.json({ error: 'Failed to deduct gold' }, { status: 500 })
    }

    // Record transaction
    await supabaseAdmin.from('gold_transactions').insert({
      user_id: user.id,
      type: 'purchase',
      amount: -SYBIL_COST_GOLD,
      balance_after: newBalance,
      reference_id: 'sybil_server_purchase',
    })

    // Create sybil server
    const { data: server, error: serverErr } = await supabaseAdmin
      .from('sybil_servers')
      .insert({
        owner_user_id: user.id,
        status: 'provisioning',
        max_sybils: 50,
      })
      .select()
      .single()

    if (serverErr) {
      // Refund gold on failure
      await supabaseAdmin
        .from('user_gold')
        .update({ balance: gold.balance })
        .eq('user_id', user.id)
      return NextResponse.json({ error: 'Failed to create sybil server' }, { status: 500 })
    }

    return NextResponse.json({ success: true, server })
  } catch (error) {
    console.error('Sybil purchase error:', error)
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
  }
}
