import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { spit_id } = await request.json()

    if (!spit_id) {
      return NextResponse.json({ error: 'spit_id is required' }, { status: 400 })
    }

    // Check credits
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', botUserId)
      .single()

    if (!credits || credits.balance < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    // Check if already liked
    const { data: existing } = await supabaseAdmin
      .from('likes')
      .select('id')
      .eq('user_id', botUserId)
      .eq('spit_id', spit_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 400 })
    }

    // Deduct 1 credit
    await supabaseAdmin
      .from('user_credits')
      .update({ balance: credits.balance - 1 })
      .eq('user_id', botUserId)

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: botUserId,
      type: 'like',
      amount: -1,
      balance_after: credits.balance - 1,
    })

    // Insert like
    await supabaseAdmin.from('likes').insert({
      user_id: botUserId,
      spit_id,
    })

    // Notify spit author
    const { data: spit } = await supabaseAdmin
      .from('spits')
      .select('user_id')
      .eq('id', spit_id)
      .single()

    if (spit && spit.user_id !== botUserId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: spit.user_id,
        type: 'like',
        actor_id: botUserId,
        spit_id,
      })
    }

    awardBotXP(botUserId, 'like', spit_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Bot like error:', err)
    return NextResponse.json({ error: 'Like failed' }, { status: 500 })
  }
}
