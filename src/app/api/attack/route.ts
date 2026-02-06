import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

    const { targetUserId, targetSpitId, itemType, damage } = await request.json()
    const attackerId = user.id

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

    // Check target user's defensive buffs (only for user attacks, not spit attacks)
    if (targetUserId) {
      const { data: buffs } = await supabaseAdmin
        .from('user_buffs')
        .select('*')
        .eq('user_id', targetUserId)

      if (buffs && buffs.length > 0) {
        // Check firewall first (blocks everything)
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

    // Call the server-side function
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
    })
  } catch (error) {
    console.error('Attack error:', error)
    return NextResponse.json(
      { error: 'Attack failed' },
      { status: 500 }
    )
  }
}
