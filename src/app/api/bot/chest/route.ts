import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP, rejectSybil } from '@/lib/bot-auth'
import { rollChestLoot } from '@/lib/items'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    // Deduct 100 credits for chest
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', botUserId)
      .single()

    if (!credits || credits.balance < 100) {
      return NextResponse.json({ error: 'Need 100 credits to open a chest' }, { status: 400 })
    }

    await supabaseAdmin
      .from('user_credits')
      .update({ balance: credits.balance - 100 })
      .eq('user_id', botUserId)

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: botUserId,
      type: 'purchase',
      amount: -100,
      balance_after: credits.balance - 100,
      reference_id: 'chest',
    })

    // Roll loot
    const loot = rollChestLoot()

    // Apply rewards
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

    return NextResponse.json({ success: true, loot })
  } catch (err) {
    console.error('Bot chest error:', err)
    return NextResponse.json({ error: 'Chest opening failed' }, { status: 500 })
  }
}
