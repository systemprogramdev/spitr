import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { rollChestLoot, LootReward } from '@/lib/items'

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

    const { chestId } = await request.json()
    const userId = user.id

    if (!chestId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate chest belongs to user and is unopened
    const { data: chest, error: chestErr } = await supabaseAdmin
      .from('user_chests')
      .select('*')
      .eq('id', chestId)
      .eq('user_id', userId)
      .eq('opened', false)
      .single()

    if (chestErr || !chest) {
      return NextResponse.json(
        { error: 'Chest not found or already opened' },
        { status: 404 }
      )
    }

    // Generate loot server-side
    const loot = rollChestLoot()

    // Apply rewards
    for (const reward of loot) {
      if (reward.type === 'credits') {
        const { data: credits } = await supabaseAdmin
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .single()

        if (credits) {
          await supabaseAdmin
            .from('user_credits')
            .update({ balance: credits.balance + reward.amount })
            .eq('user_id', userId)
        }
      } else if (reward.type === 'gold') {
        const { data: gold } = await supabaseAdmin
          .from('user_gold')
          .select('balance')
          .eq('user_id', userId)
          .single()

        if (gold) {
          await supabaseAdmin
            .from('user_gold')
            .update({ balance: gold.balance + reward.amount })
            .eq('user_id', userId)
        }
      } else if (reward.type === 'item' && reward.itemType) {
        const { data: existing } = await supabaseAdmin
          .from('user_inventory')
          .select('quantity')
          .eq('user_id', userId)
          .eq('item_type', reward.itemType)
          .single()

        const currentQty = existing?.quantity ?? 0
        await supabaseAdmin
          .from('user_inventory')
          .upsert(
            {
              user_id: userId,
              item_type: reward.itemType,
              quantity: currentQty + reward.amount,
            },
            { onConflict: 'user_id,item_type' }
          )
      }
    }

    // Mark chest as opened with loot data
    await supabaseAdmin
      .from('user_chests')
      .update({
        opened: true,
        loot: loot as unknown as Record<string, unknown>[],
        opened_at: new Date().toISOString(),
      })
      .eq('id', chestId)

    return NextResponse.json({ success: true, loot })
  } catch (error) {
    console.error('Open chest error:', error)
    return NextResponse.json(
      { error: 'Failed to open chest' },
      { status: 500 }
    )
  }
}
