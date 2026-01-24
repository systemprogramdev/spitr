'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { formatDistanceToNow } from '@/lib/utils'

interface ConversationPreview {
  id: string
  participant: {
    id: string
    handle: string
    name: string
    avatar_url: string | null
  }
  last_message: {
    content: string
    created_at: string
    sender_id: string
  } | null
  unread: boolean
}

export default function MessagesPage() {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!user) return

    const fetchConversations = async () => {
      // First get all conversation IDs the user is part of
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)

      if (!participations || participations.length === 0) {
        setIsLoading(false)
        return
      }

      const conversationIds = participations.map(p => p.conversation_id)

      // Get conversations with their latest message
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false })

      if (!conversationsData) {
        setIsLoading(false)
        return
      }

      const convos: ConversationPreview[] = []

      for (const conv of conversationsData) {
        const participation = participations.find(p => p.conversation_id === conv.id)

        // Get the other participant
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('users(*)')
          .eq('conversation_id', conv.id)
          .neq('user_id', user.id)
          .single()

        if (!otherParticipant?.users) continue

        // Get the latest message
        const { data: latestMessage } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        convos.push({
          id: conv.id,
          participant: otherParticipant.users as ConversationPreview['participant'],
          last_message: latestMessage || null,
          unread: latestMessage
            ? new Date(latestMessage.created_at) > new Date(participation?.last_read_at || 0)
            : false,
        })
      }

      setConversations(convos)
      setIsLoading(false)
    }

    fetchConversations()
  }, [user, supabase])

  return (
    <div>
      <header className="feed-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-mail" style={{ marginRight: '0.5rem' }}></span>
          Messages
        </h1>
        <Link href="/messages/new" className="btn btn-primary btn-glow btn-sm">
          <span className="sys-icon sys-icon-plus" style={{ marginRight: '0.25rem' }}></span>
          New
        </Link>
      </header>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Loading messages...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="panel-bash" style={{ margin: '1rem' }}>
          <div className="panel-bash-header">
            <div className="panel-bash-dots">
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
              <span className="panel-bash-dot"></span>
            </div>
            <span className="panel-bash-title">inbox</span>
          </div>
          <div className="panel-bash-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="sys-icon sys-icon-mail sys-icon-lg" style={{ marginBottom: '1rem', display: 'block', opacity: 0.5 }}></span>
            <p style={{ color: 'var(--sys-text-muted)' }}>No messages yet</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>
              Start a conversation with someone!
            </p>
            <Link href="/messages/new" className="btn btn-primary btn-glow" style={{ marginTop: '1rem' }}>
              <span className="sys-icon sys-icon-plus" style={{ marginRight: '0.5rem' }}></span>
              New Message
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {conversations.map((convo) => (
            <Link
              key={convo.id}
              href={`/messages/${convo.id}`}
              className="spit"
              style={{
                display: 'flex',
                gap: '0.75rem',
                backgroundColor: convo.unread ? 'var(--sys-surface)' : 'transparent',
              }}
            >
              <div
                className="avatar"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'var(--sys-primary)',
                  backgroundImage: convo.participant.avatar_url
                    ? `url(${convo.participant.avatar_url})`
                    : undefined,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: convo.unread ? 'bold' : 'normal', color: 'var(--sys-text)' }}>
                    {convo.participant.name}
                    {convo.unread && <span className="badge badge-glow" style={{ marginLeft: '0.5rem', fontSize: '0.625rem' }}>NEW</span>}
                  </span>
                  {convo.last_message && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--sys-text-muted)' }}>
                      {formatDistanceToNow(convo.last_message.created_at)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>
                  @{convo.participant.handle}
                </p>
                {convo.last_message && (
                  <p
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.875rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--sys-text-muted)',
                      fontFamily: 'var(--sys-font-mono)',
                    }}
                  >
                    {convo.last_message.sender_id === user?.id ? '> ' : ''}
                    {convo.last_message.content}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
