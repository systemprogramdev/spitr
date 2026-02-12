import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { ITEM_MAP } from '@/lib/items'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetUserId, targetSpitId, itemType, damage: baseDamage } = await request.json()
    const attackerId = user.id
    let damage = baseDamage

    if (!itemType || !damage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!targetUserId && !targetSpitId) {
      return NextResponse.json(
        { error: 'Must specify a target' },
        { status: 400 }
      )
    }

    // --- Check attacker's offensive buffs (rage serum, critical chip) ---
    let critical = false
    let rageActive = false

    if (targetUserId) {
      const { data: attackerBuffs } = await supabaseAdmin
        .from('user_buffs')
        .select('*')
        .eq('user_id', attackerId)

      if (attackerBuffs) {
        // Rage Serum: 2x damage
        const rageBuff = attackerBuffs.find(b => b.buff_type === 'rage_serum')
        if (rageBuff) {
          damage *= 2
          rageActive = true
          const newCharges = rageBuff.charges_remaining - 1
          if (newCharges <= 0) {
            await supabaseAdmin.from('user_buffs').delete().eq('id', rageBuff.id)
          } else {
            await supabaseAdmin.from('user_buffs').update({ charges_remaining: newCharges }).eq('id', rageBuff.id)
          }
        }

        // Critical Chip: 30% chance for 3x damage (applied on top of rage if both active)
        const critBuff = attackerBuffs.find(b => b.buff_type === 'critical_chip')
        if (critBuff) {
          if (Math.random() < 0.3) {
            damage = rageActive ? baseDamage * 2 * 3 : baseDamage * 3
            critical = true
          }
          const newCharges = critBuff.charges_remaining - 1
          if (newCharges <= 0) {
            await supabaseAdmin.from('user_buffs').delete().eq('id', critBuff.id)
          } else {
            await supabaseAdmin.from('user_buffs').update({ charges_remaining: newCharges }).eq('id', critBuff.id)
          }
        }
      }
    }

    // --- Check target user's defensive buffs (only for user attacks) ---
    if (targetUserId) {
      const { data: buffs } = await supabaseAdmin
        .from('user_buffs')
        .select('*')
        .eq('user_id', targetUserId)

      if (buffs && buffs.length > 0) {
        // Mirror Shield check (BEFORE firewall)
        const mirrorShield = buffs.find(b => b.buff_type === 'mirror_shield')
        if (mirrorShield) {
          // Consume mirror shield
          await supabaseAdmin.from('user_buffs').delete().eq('id', mirrorShield.id)

          // Deduct weapon from attacker
          const { data: inv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', attackerId)
            .eq('item_type', itemType)
            .single()

          if (inv) {
            if (inv.quantity <= 1) {
              await supabaseAdmin.from('user_inventory').delete().eq('user_id', attackerId).eq('item_type', itemType)
            } else {
              await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', attackerId).eq('item_type', itemType)
            }
          }

          // Apply damage to ATTACKER instead
          const { data: reflectResult } = await supabaseAdmin.rpc('perform_attack', {
            p_attacker_id: attackerId,
            p_target_user_id: attackerId,
            p_target_spit_id: null,
            p_item_type: itemType,
            p_damage: damage,
          })

          // Log attack
          await supabaseAdmin.from('attack_log').insert({
            attacker_id: attackerId,
            target_user_id: targetUserId,
            item_type: itemType,
            damage: 0,
          })

          // Notify both users
          await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId,
            type: 'attack',
            actor_id: attackerId,
            reference_id: itemType,
          })

          return NextResponse.json({
            success: true,
            reflected: true,
            reflectedDamage: damage,
            blockedBy: 'mirror_shield',
            damage: 0,
          })
        }

        // Check firewall (blocks everything)
        const firewall = buffs.find(b => b.buff_type === 'firewall')
        if (firewall) {
          // Consume firewall
          await supabaseAdmin.from('user_buffs').delete().eq('id', firewall.id)

          // Deduct weapon from attacker
          const { data: inv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', attackerId)
            .eq('item_type', itemType)
            .single()

          if (inv) {
            if (inv.quantity <= 1) {
              await supabaseAdmin.from('user_inventory').delete().eq('user_id', attackerId).eq('item_type', itemType)
            } else {
              await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', attackerId).eq('item_type', itemType)
            }
          }

          // Log attack with 0 damage
          await supabaseAdmin.from('attack_log').insert({
            attacker_id: attackerId,
            target_user_id: targetUserId,
            item_type: itemType,
            damage: 0,
          })

          // Notify target
          await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId,
            type: 'attack',
            actor_id: attackerId,
            reference_id: itemType,
          })

          return NextResponse.json({
            success: true,
            blocked: true,
            blockedBy: 'firewall',
            damage: 0,
          })
        }

        // Check kevlar (blocks everything except drone and nuke)
        const kevlar = buffs.find(b => b.buff_type === 'kevlar')
        if (kevlar && itemType !== 'drone' && itemType !== 'nuke') {
          // Decrement kevlar charges
          const newCharges = kevlar.charges_remaining - 1
          if (newCharges <= 0) {
            await supabaseAdmin.from('user_buffs').delete().eq('id', kevlar.id)
          } else {
            await supabaseAdmin.from('user_buffs').update({ charges_remaining: newCharges }).eq('id', kevlar.id)
          }

          // Deduct weapon from attacker
          const { data: inv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', attackerId)
            .eq('item_type', itemType)
            .single()

          if (inv) {
            if (inv.quantity <= 1) {
              await supabaseAdmin.from('user_inventory').delete().eq('user_id', attackerId).eq('item_type', itemType)
            } else {
              await supabaseAdmin.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('user_id', attackerId).eq('item_type', itemType)
            }
          }

          // Log attack with 0 damage
          await supabaseAdmin.from('attack_log').insert({
            attacker_id: attackerId,
            target_user_id: targetUserId,
            item_type: itemType,
            damage: 0,
          })

          // Notify target
          await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId,
            type: 'attack',
            actor_id: attackerId,
            reference_id: itemType,
          })

          return NextResponse.json({
            success: true,
            blocked: true,
            blockedBy: 'kevlar',
            chargesLeft: newCharges,
            damage: 0,
          })
        }
      }
    }

    // Call the server-side function with (possibly buffed) damage
    const { data, error } = await supabaseAdmin.rpc('perform_attack', {
      p_attacker_id: attackerId,
      p_target_user_id: targetUserId || null,
      p_target_spit_id: targetSpitId || null,
      p_item_type: itemType,
      p_damage: damage,
    })

    if (error) {
      console.error('Attack RPC error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const result = data as { success: boolean; error?: string; new_hp?: number; destroyed?: boolean; damage?: number }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Attack failed' },
        { status: 400 }
      )
    }

    // --- Post-attack special effects ---
    const extras: Record<string, any> = {}

    if (targetUserId) {
      // EMP: strip ALL buffs from target
      if (itemType === 'emp') {
        await supabaseAdmin.from('user_buffs').delete().eq('user_id', targetUserId)
        extras.buffsStripped = true
      }

      // Malware: steal random item from target
      if (itemType === 'malware') {
        const { data: targetInv } = await supabaseAdmin
          .from('user_inventory')
          .select('item_type, quantity')
          .eq('user_id', targetUserId)
          .gt('quantity', 0)

        if (targetInv && targetInv.length > 0) {
          const randomItem = targetInv[Math.floor(Math.random() * targetInv.length)]

          // Deduct 1 from target
          if (randomItem.quantity <= 1) {
            await supabaseAdmin.from('user_inventory').delete().eq('user_id', targetUserId).eq('item_type', randomItem.item_type)
          } else {
            await supabaseAdmin.from('user_inventory').update({ quantity: randomItem.quantity - 1 }).eq('user_id', targetUserId).eq('item_type', randomItem.item_type)
          }

          // Add 1 to attacker (upsert)
          const { data: attackerInv } = await supabaseAdmin
            .from('user_inventory')
            .select('quantity')
            .eq('user_id', attackerId)
            .eq('item_type', randomItem.item_type)
            .single()

          await supabaseAdmin.from('user_inventory').upsert({
            user_id: attackerId,
            item_type: randomItem.item_type,
            quantity: (attackerInv?.quantity ?? 0) + 1,
          }, { onConflict: 'user_id,item_type' })

          const itemDef = ITEM_MAP.get(randomItem.item_type as any)
          extras.stolenItem = {
            type: randomItem.item_type,
            name: itemDef?.name || randomItem.item_type,
            emoji: itemDef?.emoji || '',
          }
        }
      }
    }

    // Create notification for the target user
    if (targetUserId && targetUserId !== attackerId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: targetUserId,
        type: 'attack',
        actor_id: attackerId,
        spit_id: targetSpitId || null,
        reference_id: itemType,
      })
    }

    // If attacking a spit, notify the spit owner
    if (targetSpitId && !targetUserId) {
      const { data: spit } = await supabaseAdmin
        .from('spits')
        .select('user_id')
        .eq('id', targetSpitId)
        .single()

      if (spit && spit.user_id !== attackerId) {
        await supabaseAdmin.from('notifications').insert({
          user_id: spit.user_id,
          type: 'attack',
          actor_id: attackerId,
          spit_id: targetSpitId,
          reference_id: itemType,
        })
      }
    }

    return NextResponse.json({
      success: true,
      newHp: result.new_hp,
      destroyed: result.destroyed,
      damage: result.damage,
      critical,
      ...extras,
    })
  } catch (error) {
    console.error('Attack error:', error)
    return NextResponse.json(
      { error: 'Attack failed' },
      { status: 500 }
    )
  }
}
