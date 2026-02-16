import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin, rejectSybil } from '@/lib/bot-auth'

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })
  const blocked = rejectSybil(context); if (blocked) return blocked

  const { botUserId } = context

  try {
    const conversationId = request.nextUrl.searchParams.get('conversation_id')

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversation_id parameter' }, { status: 400 })
    }

    // Validate bot is a participant in this conversation
    const { data: participation } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', botUserId)
      .maybeSingle()

    if (!participation) {
      return NextResponse.json({ error: 'Not a participant in this conversation' }, { status: 403 })
    }

    // Fetch last 50 messages
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (msgErr) {
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark as read by updating last_read_at
    await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', botUserId)

    return NextResponse.json({ messages: messages ?? [] })
  } catch (err) {
    console.error('Bot DM messages error:', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
