import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const POWERUP_CONFIG: Record<string, { charges: number }> = {
  rage_serum: { charges: 3 },
  critical_chip: { charges: 5 },
  xp_boost: { charges: 1 },
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemType } = await request.json()
    const userId = user.id

    const config = POWERUP_CONFIG[itemType]
    if (!config) {
      return NextResponse.json({ error: 'Invalid power-up item' }, { status: 400 })
    }

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json({ error: "You don't have this item" }, { status: 400 })
    }

    // Check if buff already active
    const { data: existing } = await supabaseAdmin
      .from('user_buffs')
      .select('id')
      .eq('user_id', userId)
      .eq('buff_type', itemType)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This power-up is already active' }, { status: 400 })
    }

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin.from('user_inventory').delete().eq('user_id', userId).eq('item_type', itemType)
    } else {
      await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', userId).eq('item_type', itemType)
    }

    // Activate buff
    await supabaseAdmin.from('user_buffs').insert({
      user_id: userId,
      buff_type: itemType,
      charges_remaining: config.charges,
    })

    return NextResponse.json({
      success: true,
      buffType: itemType,
      charges: config.charges,
    })
  } catch (error) {
    console.error('Use power-up error:', error)
    return NextResponse.json({ error: 'Failed to activate power-up' }, { status: 500 })
  }
}
