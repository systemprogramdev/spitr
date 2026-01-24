'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { User } from '@/types'
import { formatDistanceToNow } from '@/lib/utils'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [participant, setParticipant] = useState<User | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const conversationId = params.id as string

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!user || !conversationId) return

    const fetchConversation = async () => {
      // Get other participant
      const { data: otherParticipant } = await supabase
        .from('conversation_participants')
        .select('users(*)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .single()

      if (otherParticipant?.users) {
        setParticipant(otherParticipant.users as User)
      }

      // Get messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
      setIsLoading(false)

      // Mark as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    }

    fetchConversation()

    // Subscribe to new messages from other users
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          // Only add if not already in the list (avoid duplicates from own messages)
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            // Also check for temp messages that should be replaced
            if (newMsg.sender_id === user?.id) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, conversationId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || isSending) return

    setIsSending(true)
    const messageContent = newMessage.trim()
    setNewMessage('') // Clear immediately for better UX

    // Optimistic update - add message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])

    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: messageContent,
    }).select().single()

    if (error) {
      console.error('Error sending message:', error.message)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
      setNewMessage(messageContent) // Restore message on error
    } else if (data) {
      // Replace optimistic message with real one
      setMessages((prev) => prev.map((m) => m.id === optimisticMessage.id ? data : m))
      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    setIsSending(false)
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Loading conversation...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => router.back()}
          className="btn btn-sm"
          style={{ background: 'none', border: 'none', padding: '0.5rem' }}
        >
          <span className="sys-icon sys-icon-arrow-left"></span>
        </button>
        {participant && (
          <Link href={`/${participant.handle}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="avatar"
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--sys-primary)',
                backgroundImage: participant.avatar_url ? `url(${participant.avatar_url})` : undefined,
              }}
            />
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--sys-text)' }}>{participant.name}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>@{participant.handle}</div>
            </div>
          </Link>
        )}
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--sys-text-muted)' }}>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    className={isOwn ? 'panel-bash' : ''}
                    style={{
                      maxWidth: '70%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: isOwn ? 'var(--sys-primary)' : 'var(--sys-surface)',
                      color: isOwn ? 'var(--sys-bg)' : 'var(--sys-text)',
                    }}
                  >
                    <p style={{ fontFamily: 'var(--sys-font-mono)', wordBreak: 'break-word' }}>
                      {isOwn && '> '}{msg.content}
                    </p>
                    <p style={{
                      marginTop: '0.25rem',
                      fontSize: '0.625rem',
                      opacity: 0.7,
                      textAlign: isOwn ? 'right' : 'left',
                    }}>
                      {formatDistanceToNow(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--sys-border)',
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <input
          type="text"
          className="input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1 }}
          disabled={isSending}
        />
        <button
          type="submit"
          className="btn btn-primary btn-glow"
          disabled={!newMessage.trim() || isSending}
        >
          <span className="sys-icon sys-icon-send"></span>
        </button>
      </form>
    </div>
  )
}
