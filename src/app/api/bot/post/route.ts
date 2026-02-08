import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { content } = await request.json()

    // URLs count as 23 chars toward the limit
    const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
    const effectiveLength = content ? content.replace(URL_REGEX, (url: string) => 'x'.repeat(Math.min(url.length, 23))).length : 0
    if (!content || typeof content !== 'string' || effectiveLength > 280) {
      return NextResponse.json({ error: 'Invalid content (max 280 chars)' }, { status: 400 })
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
      type: 'post',
      amount: -1,
      balance_after: credits.balance - 1,
    })

    // Create spit
    const { data: spit, error: spitErr } = await supabaseAdmin
      .from('spits')
      .insert({ user_id: botUserId, content })
      .select('id')
      .single()

    if (spitErr) {
      return NextResponse.json({ error: spitErr.message }, { status: 500 })
    }

    awardBotXP(botUserId, 'post', spit.id)

    return NextResponse.json({ success: true, spit_id: spit.id })
  } catch (err) {
    console.error('Bot post error:', err)
    return NextResponse.json({ error: 'Post failed' }, { status: 500 })
  }
}
