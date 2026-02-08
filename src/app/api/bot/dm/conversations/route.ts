import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    // Get all conversations the bot is part of
    const { data: participations } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', botUserId)

    if (!participations || participations.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const convIds = participations.map(p => p.conversation_id)

    // Get the other participant for each conversation
    const { data: otherParticipants } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
      .neq('user_id', botUserId)

    if (!otherParticipants) {
      return NextResponse.json({ conversations: [] })
    }

    // Get user info for other participants
    const otherUserIds = [...new Set(otherParticipants.map(p => p.user_id))]
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, handle, name, avatar_url')
      .in('id', otherUserIds)

    const userMap = new Map(users?.map(u => [u.id, u]) ?? [])

    // Get latest message per conversation
    const conversations = await Promise.all(
      participations.map(async (p) => {
        const otherPart = otherParticipants.find(op => op.conversation_id === p.conversation_id)
        const otherUser = otherPart ? userMap.get(otherPart.user_id) : null

        const { data: msgs } = await supabaseAdmin
          .from('messages')
          .select('id, content, sender_id, created_at')
          .eq('conversation_id', p.conversation_id)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMessage = msgs?.[0] ?? null

        // Check unread: latest message from other user is newer than last_read_at
        let unread = false
        if (lastMessage && lastMessage.sender_id !== botUserId) {
          const msgTime = new Date(lastMessage.created_at).getTime()
          const readTime = p.last_read_at ? new Date(p.last_read_at).getTime() : 0
          unread = msgTime > readTime
        }

        return {
          id: p.conversation_id,
          participant: otherUser ? {
            id: otherUser.id,
            handle: otherUser.handle,
            name: otherUser.name,
          } : null,
          last_message: lastMessage ? {
            content: lastMessage.content,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at,
          } : null,
          unread,
        }
      })
    )

    // Sort by last message time (most recent first)
    conversations.sort((a, b) => {
      const aTime = a.last_message ? new Date(a.last_message.created_at).getTime() : 0
      const bTime = b.last_message ? new Date(b.last_message.created_at).getTime() : 0
      return bTime - aTime
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('Bot DM conversations error:', err)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
