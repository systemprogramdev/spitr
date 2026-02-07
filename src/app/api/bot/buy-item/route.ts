import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { ITEM_MAP } from '@/lib/items'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { itemType, quantity = 1 } = await request.json()

    if (!itemType) {
      return NextResponse.json({ error: 'itemType is required' }, { status: 400 })
    }

    const item = ITEM_MAP.get(itemType)
    if (!item) {
      return NextResponse.json({ error: 'Unknown item' }, { status: 400 })
    }

    const totalCost = item.goldCost * quantity

    // Check gold
    const { data: gold } = await supabaseAdmin
      .from('user_gold')
      .select('balance')
      .eq('user_id', botUserId)
      .single()

    if (!gold || gold.balance < totalCost) {
      return NextResponse.json({ error: 'Insufficient gold' }, { status: 400 })
    }

    // Deduct gold
    await supabaseAdmin
      .from('user_gold')
      .update({ balance: gold.balance - totalCost })
      .eq('user_id', botUserId)

    await supabaseAdmin.from('gold_transactions').insert({
      user_id: botUserId,
      type: 'purchase',
      amount: -totalCost,
      balance_after: gold.balance - totalCost,
      reference_id: itemType,
    })

    // Upsert inventory
    const { data: existing } = await supabaseAdmin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', botUserId)
      .eq('item_type', itemType)
      .single()

    const currentQty = existing?.quantity ?? 0
    await supabaseAdmin
      .from('user_inventory')
      .upsert(
        { user_id: botUserId, item_type: itemType, quantity: currentQty + quantity },
        { onConflict: 'user_id,item_type' }
      )

    return NextResponse.json({ success: true, newGold: gold.balance - totalCost, quantity: currentQty + quantity })
  } catch (err) {
    console.error('Bot buy-item error:', err)
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
  }
}
