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

    const userId = user.id

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', 'fake_death')
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json({ error: "You don't have Fake Death" }, { status: 400 })
    }

    // Check if already active
    const { data: existing } = await supabaseAdmin
      .from('user_buffs')
      .select('id, activated_at')
      .eq('user_id', userId)
      .eq('buff_type', 'fake_death')
      .single()

    if (existing) {
      const activatedAt = new Date(existing.activated_at)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
      if (activatedAt > twelveHoursAgo) {
        return NextResponse.json({ error: 'Fake Death is already active' }, { status: 400 })
      }
      // Expired, delete old buff
      await supabaseAdmin.from('user_buffs').delete().eq('id', existing.id)
    }

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin.from('user_inventory').delete().eq('user_id', userId).eq('item_type', 'fake_death')
    } else {
      await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', userId).eq('item_type', 'fake_death')
    }

    // Activate buff
    await supabaseAdmin.from('user_buffs').insert({
      user_id: userId,
      buff_type: 'fake_death',
      charges_remaining: 1,
    })

    return NextResponse.json({
      success: true,
      duration: '12 hours',
    })
  } catch (error) {
    console.error('Use fake death error:', error)
    return NextResponse.json({ error: 'Failed to activate Fake Death' }, { status: 500 })
  }
}
