import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { validateDatacenterKey } from '@/lib/bot-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYBIL_COST_GOLD = 1000

export async function POST(request: NextRequest) {
  try {
    let ownerUserId: string

    // Try datacenter key auth first, fall back to cookie auth
    const datacenterKey = request.headers.get('X-Datacenter-Key')
    if (datacenterKey) {
      const { valid, error, status } = await validateDatacenterKey(request)
      if (!valid) return NextResponse.json({ error }, { status })

      const body = await request.json()
      if (!body.owner_user_id) {
        return NextResponse.json({ error: 'owner_user_id is required for datacenter auth' }, { status: 400 })
      }
      ownerUserId = body.owner_user_id
    } else {
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      ownerUserId = user.id
    }

    // Check if user already has a sybil server
    const { data: existing } = await supabaseAdmin
      .from('sybil_servers')
      .select('id, status')
      .eq('owner_user_id', ownerUserId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You already have a Sybil Server', server: existing }, { status: 409 })
    }

    // Check gold balance
    const { data: gold } = await supabaseAdmin
      .from('user_gold')
      .select('balance')
      .eq('user_id', ownerUserId)
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
      .eq('user_id', ownerUserId)

    if (deductErr) {
      return NextResponse.json({ error: 'Failed to deduct gold' }, { status: 500 })
    }

    // Record transaction
    await supabaseAdmin.from('gold_transactions').insert({
      user_id: ownerUserId,
      type: 'purchase',
      amount: -SYBIL_COST_GOLD,
      balance_after: newBalance,
      reference_id: 'sybil_server_purchase',
    })

    // Create sybil server
    const { data: server, error: serverErr } = await supabaseAdmin
      .from('sybil_servers')
      .insert({
        owner_user_id: ownerUserId,
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
        .eq('user_id', ownerUserId)
      return NextResponse.json({ error: 'Failed to create sybil server' }, { status: 500 })
    }

    return NextResponse.json({ success: true, server })
  } catch (error) {
    console.error('Sybil purchase error:', error)
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
  }
}
