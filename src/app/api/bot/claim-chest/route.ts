import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'
import { rollChestLoot } from '@/lib/items'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    // Check eligibility
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('last_chest_claimed_at')
      .eq('id', botUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    const lastClaimed = user.last_chest_claimed_at
      ? new Date(user.last_chest_claimed_at).getTime()
      : 0

    if (Date.now() - lastClaimed < TWENTY_FOUR_HOURS_MS) {
      return NextResponse.json({ error: 'Daily chest already claimed' }, { status: 400 })
    }

    // Claim: update timestamp
    await supabaseAdmin
      .from('users')
      .update({ last_chest_claimed_at: new Date().toISOString() })
      .eq('id', botUserId)

    // Roll loot and apply rewards
    const loot = rollChestLoot()

    for (const reward of loot) {
      if (reward.type === 'credits') {
        const { data: c } = await supabaseAdmin
          .from('user_credits')
          .select('balance')
          .eq('user_id', botUserId)
          .single()
        if (c) {
          await supabaseAdmin
            .from('user_credits')
            .update({ balance: c.balance + reward.amount })
            .eq('user_id', botUserId)
        }
      } else if (reward.type === 'gold') {
        const { data: g } = await supabaseAdmin
          .from('user_gold')
          .select('balance')
          .eq('user_id', botUserId)
          .single()
        if (g) {
          await supabaseAdmin
            .from('user_gold')
            .update({ balance: g.balance + reward.amount })
            .eq('user_id', botUserId)
        }
      } else if (reward.type === 'item' && reward.itemType) {
        const { data: existing } = await supabaseAdmin
          .from('user_inventory')
          .select('quantity')
          .eq('user_id', botUserId)
          .eq('item_type', reward.itemType)
          .single()

        const currentQty = existing?.quantity ?? 0
        await supabaseAdmin
          .from('user_inventory')
          .upsert(
            { user_id: botUserId, item_type: reward.itemType, quantity: currentQty + reward.amount },
            { onConflict: 'user_id,item_type' }
          )
      }
    }

    awardBotXP(botUserId, 'chest_open')

    return NextResponse.json({ success: true, rewards: loot })
  } catch (err) {
    console.error('Bot claim-chest error:', err)
    return NextResponse.json({ error: 'Failed to claim chest' }, { status: 500 })
  }
}
