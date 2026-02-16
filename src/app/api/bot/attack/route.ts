import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP, rejectSybil } from '@/lib/bot-auth'
import { ITEMS } from '@/lib/items'

const WEAPON_DAMAGE: Record<string, number> = {}
for (const item of ITEMS) {
  if (item.category === 'weapon' && item.damage) {
    WEAPON_DAMAGE[item.type] = item.damage
  }
}

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    const body = await request.json()

    // Accept both camelCase and snake_case
    const targetUserId = body.targetUserId || body.target_user_id || null
    const targetSpitId = body.targetSpitId || body.target_spit_id || null
    let itemType = body.itemType || body.item_type || null
    let damage = body.damage || null

    if (!targetUserId && !targetSpitId) {
      return NextResponse.json({ error: 'Must specify a target' }, { status: 400 })
    }

    // Auto-pick weapon from inventory if not specified
    if (!itemType) {
      const { data: inventory } = await supabaseAdmin
        .from('user_inventory')
        .select('item_type, quantity')
        .eq('user_id', botUserId)
        .in('item_type', Object.keys(WEAPON_DAMAGE))
        .gt('quantity', 0)
        .order('item_type')

      if (!inventory || inventory.length === 0) {
        return NextResponse.json({ error: 'No weapons in inventory' }, { status: 400 })
      }

      // Pick the best weapon available
      const weaponPriority = ['nuke', 'drone', 'soldier', 'gun', 'knife']
      const picked = weaponPriority.find(w => inventory.some(i => i.item_type === w)) || inventory[0].item_type
      itemType = picked
    }

    if (!WEAPON_DAMAGE[itemType]) {
      return NextResponse.json({ error: 'Invalid weapon type' }, { status: 400 })
    }

    damage = damage || WEAPON_DAMAGE[itemType]

    // Check target user's defensive buffs
    if (targetUserId) {
      const { data: buffs } = await supabaseAdmin
        .from('user_buffs')
        .select('*')
        .eq('user_id', targetUserId)

      if (buffs && buffs.length > 0) {
        // Check firewall first
        const firewall = buffs.find(b => b.buff_type === 'firewall')
        if (firewall) {
          await supabaseAdmin.from('user_buffs').delete().eq('id', firewall.id)

          // Deduct weapon from bot
          const { data: inv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', botUserId)
            .eq('item_type', itemType)
            .single()

          if (inv) {
            if (inv.quantity <= 1) {
              await supabaseAdmin.from('user_inventory').delete().eq('user_id', botUserId).eq('item_type', itemType)
            } else {
              await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', botUserId).eq('item_type', itemType)
            }
          }

          await supabaseAdmin.from('attack_log').insert({
            attacker_id: botUserId,
            target_user_id: targetUserId,
            item_type: itemType,
            damage: 0,
          })

          await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId,
            type: 'attack',
            actor_id: botUserId,
            reference_id: itemType,
          })

          return NextResponse.json({ success: true, blocked: true, blockedBy: 'firewall', damage: 0 })
        }

        // Check kevlar
        const kevlar = buffs.find(b => b.buff_type === 'kevlar')
        if (kevlar && itemType !== 'drone' && itemType !== 'nuke') {
          const newCharges = kevlar.charges_remaining - 1
          if (newCharges <= 0) {
            await supabaseAdmin.from('user_buffs').delete().eq('id', kevlar.id)
          } else {
            await supabaseAdmin.from('user_buffs').update({ charges_remaining: newCharges }).eq('id', kevlar.id)
          }

          const { data: inv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', botUserId)
            .eq('item_type', itemType)
            .single()

          if (inv) {
            if (inv.quantity <= 1) {
              await supabaseAdmin.from('user_inventory').delete().eq('user_id', botUserId).eq('item_type', itemType)
            } else {
              await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', botUserId).eq('item_type', itemType)
            }
          }

          await supabaseAdmin.from('attack_log').insert({
            attacker_id: botUserId,
            target_user_id: targetUserId,
            item_type: itemType,
            damage: 0,
          })

          await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId,
            type: 'attack',
            actor_id: botUserId,
            reference_id: itemType,
          })

          return NextResponse.json({ success: true, blocked: true, blockedBy: 'kevlar', chargesLeft: newCharges, damage: 0 })
        }
      }
    }

    // Perform the attack
    const { data, error: rpcErr } = await supabaseAdmin.rpc('perform_attack', {
      p_attacker_id: botUserId,
      p_target_user_id: targetUserId || null,
      p_target_spit_id: targetSpitId || null,
      p_item_type: itemType,
      p_damage: damage,
    })

    if (rpcErr) {
      console.error('Bot attack RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const result = data as { success: boolean; error?: string; new_hp?: number; destroyed?: boolean; damage?: number }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Attack failed' }, { status: 400 })
    }

    // Notify target
    if (targetUserId && targetUserId !== botUserId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: targetUserId,
        type: 'attack',
        actor_id: botUserId,
        spit_id: targetSpitId || null,
        reference_id: itemType,
      })
    }

    if (targetSpitId && !targetUserId) {
      const { data: spit } = await supabaseAdmin
        .from('spits')
        .select('user_id')
        .eq('id', targetSpitId)
        .single()

      if (spit && spit.user_id !== botUserId) {
        await supabaseAdmin.from('notifications').insert({
          user_id: spit.user_id,
          type: 'attack',
          actor_id: botUserId,
          spit_id: targetSpitId,
          reference_id: itemType,
        })
      }
    }

    awardBotXP(botUserId, 'attack')

    return NextResponse.json({
      success: true,
      newHp: result.new_hp,
      destroyed: result.destroyed,
      damage: result.damage,
    })
  } catch (err) {
    console.error('Bot attack error:', err)
    return NextResponse.json({ error: 'Attack failed' }, { status: 500 })
  }
}
