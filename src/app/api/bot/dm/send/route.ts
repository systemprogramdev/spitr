import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, awardBotXP } from '@/lib/bot-auth'

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const { target_user_id, content } = await request.json()

    if (!target_user_id || typeof target_user_id !== 'string') {
      return NextResponse.json({ error: 'Missing target_user_id' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.length > 2000) {
      return NextResponse.json({ error: 'Invalid content (max 2000 chars)' }, { status: 400 })
    }

    if (target_user_id === botUserId) {
      return NextResponse.json({ error: 'Cannot DM yourself' }, { status: 400 })
    }

    // Verify target user exists
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', target_user_id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Find or create conversation (replicating create_or_get_conversation RPC logic)
    // The RPC uses auth.uid() so bots can't call it directly
    let conversationId: string | null = null

    // Check if conversation already exists between bot and target
    const { data: existing } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', botUserId)

    if (existing && existing.length > 0) {
      const convIds = existing.map(e => e.conversation_id)

      const { data: match } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', target_user_id)
        .in('conversation_id', convIds)

      if (match && match.length > 0) {
        conversationId = match[0].conversation_id
      }
    }

    // Create new conversation if none exists
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .insert({})
        .select('id')
        .single()

      if (convErr || !conv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      conversationId = conv.id

      // Add both participants
      const { error: partErr } = await supabaseAdmin
        .from('conversation_participants')
        .insert([
          { conversation_id: conversationId, user_id: botUserId },
          { conversation_id: conversationId, user_id: target_user_id },
        ])

      if (partErr) {
        return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 })
      }
    }

    // Insert message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: botUserId,
        content,
      })
      .select('id')
      .single()

    if (msgErr || !message) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Update conversation timestamp
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Send notification to target
    await supabaseAdmin.from('notifications').insert({
      user_id: target_user_id,
      type: 'message',
      actor_id: botUserId,
      reference_id: conversationId,
    })

    awardBotXP(botUserId, 'dm_send', message.id)

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      message_id: message.id,
    })
  } catch (err) {
    console.error('Bot DM send error:', err)
    return NextResponse.json({ error: 'DM send failed' }, { status: 500 })
  }
}
