import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, rejectSybil } from '@/lib/bot-auth'
import { SPIT_TO_GOLD_RATIO } from '@/lib/items'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    const body = await request.json()
    const direction = body.direction || 'spits_to_gold' // 'spits_to_gold' or 'gold_to_spits'
    const amount = body.amount

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (direction === 'spits_to_gold' || direction === 'spit_to_gold') {
      const spits = Math.floor(amount)
      if (spits < SPIT_TO_GOLD_RATIO) {
        return NextResponse.json({ error: `Need at least ${SPIT_TO_GOLD_RATIO} spits` }, { status: 400 })
      }

      const goldToGet = Math.floor(spits / SPIT_TO_GOLD_RATIO)
      const actualCost = goldToGet * SPIT_TO_GOLD_RATIO

      // Deduct spits
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('balance')
        .eq('user_id', botUserId)
        .single()

      if (!credits || credits.balance < actualCost) {
        return NextResponse.json({ error: 'Insufficient spits' }, { status: 400 })
      }

      await supabaseAdmin.from('user_credits')
        .update({ balance: credits.balance - actualCost })
        .eq('user_id', botUserId)

      await supabaseAdmin.from('credit_transactions').insert({
        user_id: botUserId,
        type: 'convert',
        amount: -actualCost,
        balance_after: credits.balance - actualCost,
        reference_id: 'gold_convert',
      })

      // Add gold
      const { data: gold } = await supabaseAdmin
        .from('user_gold')
        .select('balance')
        .eq('user_id', botUserId)
        .single()

      const newGold = (gold?.balance || 0) + goldToGet
      await supabaseAdmin.from('user_gold')
        .update({ balance: newGold })
        .eq('user_id', botUserId)

      await supabaseAdmin.from('gold_transactions').insert({
        user_id: botUserId,
        type: 'convert',
        amount: goldToGet,
        balance_after: newGold,
      })

      return NextResponse.json({ success: true, spitsSpent: actualCost, goldReceived: goldToGet })

    } else if (direction === 'gold_to_spits' || direction === 'gold_to_spit') {
      const gold = Math.floor(amount)
      if (gold < 1) {
        return NextResponse.json({ error: 'Need at least 1 gold' }, { status: 400 })
      }

      const spitsToGet = gold * SPIT_TO_GOLD_RATIO

      // Deduct gold
      const { data: goldData } = await supabaseAdmin
        .from('user_gold')
        .select('balance')
        .eq('user_id', botUserId)
        .single()

      if (!goldData || goldData.balance < gold) {
        return NextResponse.json({ error: 'Insufficient gold' }, { status: 400 })
      }

      await supabaseAdmin.from('user_gold')
        .update({ balance: goldData.balance - gold })
        .eq('user_id', botUserId)

      await supabaseAdmin.from('gold_transactions').insert({
        user_id: botUserId,
        type: 'convert',
        amount: -gold,
        balance_after: goldData.balance - gold,
      })

      // Add spits
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('balance')
        .eq('user_id', botUserId)
        .single()

      const newBalance = (credits?.balance || 0) + spitsToGet
      await supabaseAdmin.from('user_credits')
        .update({ balance: newBalance })
        .eq('user_id', botUserId)

      await supabaseAdmin.from('credit_transactions').insert({
        user_id: botUserId,
        type: 'convert',
        amount: spitsToGet,
        balance_after: newBalance,
        reference_id: 'gold_convert',
      })

      return NextResponse.json({ success: true, goldSpent: gold, spitsReceived: spitsToGet })

    } else {
      return NextResponse.json({ error: 'Invalid direction. Use spits_to_gold or gold_to_spits' }, { status: 400 })
    }
  } catch (err) {
    console.error('Bot convert error:', err)
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
