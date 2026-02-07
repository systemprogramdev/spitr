import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { ITEM_MAP } from '@/lib/items'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { itemType } = await request.json()

    if (!itemType) {
      return NextResponse.json({ error: 'itemType is required' }, { status: 400 })
    }

    const item = ITEM_MAP.get(itemType)
    if (!item) {
      return NextResponse.json({ error: 'Unknown item' }, { status: 400 })
    }

    if (item.category === 'potion') {
      // Use potion RPC
      const { data, error: rpcErr } = await supabaseAdmin.rpc('use_potion', {
        p_user_id: botUserId,
        p_item_type: itemType,
        p_heal_amount: item.healAmount || 0,
      })

      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }

      const result = data as { success: boolean; error?: string; new_hp?: number; healed?: number }

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Potion use failed' }, { status: 400 })
      }

      return NextResponse.json({ success: true, newHp: result.new_hp, healed: result.healed })
    }

    if (item.category === 'defense') {
      if (itemType !== 'firewall' && itemType !== 'kevlar') {
        return NextResponse.json({ error: 'Invalid defense item' }, { status: 400 })
      }

      // Check inventory
      const { data: inv } = await supabaseAdmin
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', botUserId)
        .eq('item_type', itemType)
        .single()

      if (!inv || inv.quantity < 1) {
        return NextResponse.json({ error: 'Item not in inventory' }, { status: 400 })
      }

      // Check existing buff
      const { data: existing } = await supabaseAdmin
        .from('user_buffs')
        .select('id')
        .eq('user_id', botUserId)
        .eq('buff_type', itemType)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Defense already active' }, { status: 400 })
      }

      const charges = itemType === 'kevlar' ? 3 : 1

      // Deduct from inventory
      if (inv.quantity === 1) {
        await supabaseAdmin.from('user_inventory').delete().eq('user_id', botUserId).eq('item_type', itemType)
      } else {
        await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', botUserId).eq('item_type', itemType)
      }

      // Activate buff
      await supabaseAdmin.from('user_buffs').insert({
        user_id: botUserId,
        buff_type: itemType,
        charges_remaining: charges,
      })

      return NextResponse.json({ success: true, buffType: itemType, charges })
    }

    return NextResponse.json({ error: 'Cannot use this item type' }, { status: 400 })
  } catch (err) {
    console.error('Bot use-item error:', err)
    return NextResponse.json({ error: 'Failed to use item' }, { status: 500 })
  }
}
