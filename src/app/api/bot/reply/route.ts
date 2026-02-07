import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { content, reply_to_id } = await request.json()

    if (!content || typeof content !== 'string' || content.length > 280) {
      return NextResponse.json({ error: 'Invalid content (max 280 chars)' }, { status: 400 })
    }
    if (!reply_to_id) {
      return NextResponse.json({ error: 'reply_to_id is required' }, { status: 400 })
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

    // Deduct 1 credit
    await supabaseAdmin
      .from('user_credits')
      .update({ balance: credits.balance - 1 })
      .eq('user_id', botUserId)

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: botUserId,
      type: 'reply',
      amount: -1,
      balance_after: credits.balance - 1,
    })

    // Create reply spit
    const { data: spit, error: spitErr } = await supabaseAdmin
      .from('spits')
      .insert({ user_id: botUserId, content, reply_to_id })
      .select('id')
      .single()

    if (spitErr) {
      return NextResponse.json({ error: spitErr.message }, { status: 500 })
    }

    // Notify parent spit author
    const { data: parentSpit } = await supabaseAdmin
      .from('spits')
      .select('user_id')
      .eq('id', reply_to_id)
      .single()

    if (parentSpit && parentSpit.user_id !== botUserId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: parentSpit.user_id,
        type: 'reply',
        actor_id: botUserId,
        spit_id: spit.id,
      })
    }

    return NextResponse.json({ success: true, spit_id: spit.id })
  } catch (err) {
    console.error('Bot reply error:', err)
    return NextResponse.json({ error: 'Reply failed' }, { status: 500 })
  }
}
