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

    const { itemType } = await request.json()
    const userId = user.id

    if (itemType !== 'firewall' && itemType !== 'kevlar') {
      return NextResponse.json(
        { error: 'Invalid defense item' },
        { status: 400 }
      )
    }

    // Check inventory
    const { data: inv } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .single()

    if (!inv || inv.quantity < 1) {
      return NextResponse.json(
        { error: 'You don\'t have this item' },
        { status: 400 }
      )
    }

    // Check if buff already active
    const { data: existing } = await supabaseAdmin
      .from('user_buffs')
      .select('id')
      .eq('user_id', userId)
      .eq('buff_type', itemType)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This defense is already active' },
        { status: 400 }
      )
    }

    const charges = itemType === 'kevlar' ? 3 : 1

    // Deduct from inventory
    if (inv.quantity === 1) {
      await supabaseAdmin
        .from('user_inventory')
        .delete()
        .eq('user_id', userId)
        .eq('item_type', itemType)
    } else {
      await supabaseAdmin
        .from('user_inventory')
        .update({ quantity: inv.quantity - 1 })
        .eq('user_id', userId)
        .eq('item_type', itemType)
    }

    // Activate buff
    await supabaseAdmin.from('user_buffs').insert({
      user_id: userId,
      buff_type: itemType,
      charges_remaining: charges,
    })

    return NextResponse.json({
      success: true,
      buffType: itemType,
      charges,
    })
  } catch (error) {
    console.error('Use defense error:', error)
    return NextResponse.json(
      { error: 'Failed to activate defense' },
      { status: 500 }
    )
  }
}
