import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { target_user_id } = await request.json()

    if (!target_user_id) {
      return NextResponse.json({ error: 'target_user_id is required' }, { status: 400 })
    }

    if (target_user_id === botUserId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    // Check if already following
    const { data: existing } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', botUserId)
      .eq('following_id', target_user_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already following' }, { status: 400 })
    }

    // Insert follow
    await supabaseAdmin.from('follows').insert({
      follower_id: botUserId,
      following_id: target_user_id,
    })

    // Notify target
    await supabaseAdmin.from('notifications').insert({
      user_id: target_user_id,
      type: 'follow',
      actor_id: botUserId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Bot follow error:', err)
    return NextResponse.json({ error: 'Follow failed' }, { status: 500 })
  }
}
