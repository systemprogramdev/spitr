'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { User } from '@/types'

function NewMessageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [message, setMessage] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false)
  const supabase = createClient()

  // Auto-select user from URL param
  useEffect(() => {
    const toHandle = searchParams.get('to')
    if (toHandle && user && !selectedUser) {
      setIsLoadingRecipient(true)
      supabase
        .from('users')
        .select('*')
        .ilike('handle', toHandle)
        .neq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedUser(data)
          }
          setIsLoadingRecipient(false)
        })
    }
  }, [searchParams, user, selectedUser, supabase])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !user) {
      setUsers([])
      return
    }

    setIsSearching(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .or(`handle.ilike.%${query}%,name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(10)

    setUsers(data || [])
    setIsSearching(false)
  }

  const handleSelectUser = (selectedUser: User) => {
    setSelectedUser(selectedUser)
    setSearchQuery('')
    setUsers([])
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !message.trim() || !user || isSending) return

    setIsSending(true)

    try {
      // Use the database function to create or get conversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: convData, error: convError } = await (supabase as any)
        .rpc('create_or_get_conversation', { other_user_id: selectedUser.id })

      if (convError) {
        console.error('Error creating conversation:', convError.message)
        // Fallback: try the old way
        const { data: existingParticipation } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id)

        let conversationId: string | null = null

        if (existingParticipation) {
          for (const p of existingParticipation) {
            const { data: otherParticipant } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', p.conversation_id)
              .eq('user_id', selectedUser.id)
              .single()

            if (otherParticipant) {
              conversationId = p.conversation_id
              break
            }
          }
        }

        if (!conversationId) {
          const { data: newConvo } = await supabase
            .from('conversations')
            .insert({})
            .select('id')
            .single()

          if (newConvo) {
            conversationId = newConvo.id
            await supabase.from('conversation_participants').insert([
              { conversation_id: conversationId, user_id: user.id },
              { conversation_id: conversationId, user_id: selectedUser.id },
            ])
          }
        }

        if (conversationId) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: message.trim(),
          })
          router.push(`/messages/${conversationId}`)
        }
      } else {
        // Function succeeded - send the message
        const conversationId = convData as string

        const { error: msgError } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: message.trim(),
        })

        if (msgError) {
          console.error('Error sending message:', msgError.message)
        } else {
          router.push(`/messages/${conversationId}`)
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    }

    setIsSending(false)
  }

  if (isLoadingRecipient) {
    return (
      <div>
        <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.back()}
            className="btn btn-sm"
            style={{ background: 'none', border: 'none', padding: '0.5rem' }}
          >
            <span className="sys-icon sys-icon-arrow-left"></span>
          </button>
          <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
            New Message
          </h1>
        </header>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => router.back()}
          className="btn btn-sm"
          style={{ background: 'none', border: 'none', padding: '0.5rem' }}
        >
          <span className="sys-icon sys-icon-arrow-left"></span>
        </button>
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          New Message
        </h1>
      </header>

      <div style={{ padding: '1rem' }}>
        {!selectedUser ? (
          <div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for a user..."
                style={{ width: '100%' }}
              />
              {isSearching && (
                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="loading-spinner" style={{ width: '1rem', height: '1rem' }}></div>
                </div>
              )}
            </div>

            {users.length > 0 && (
              <div className="panel-bash" style={{ marginTop: '0.5rem' }}>
                <div className="panel-bash-header">
                  <div className="panel-bash-dots">
                    <span className="panel-bash-dot"></span>
                    <span className="panel-bash-dot"></span>
                    <span className="panel-bash-dot"></span>
                  </div>
                  <span className="panel-bash-title">results</span>
                </div>
                <div className="panel-bash-body" style={{ padding: 0 }}>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid var(--sys-border)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        className="avatar"
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: 'var(--sys-primary)',
                          backgroundImage: u.avatar_url ? `url(${u.avatar_url})` : undefined,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--sys-text)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>@{u.handle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && users.length === 0 && !isSearching && (
              <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
                No users found for &quot;{searchQuery}&quot;
              </p>
            )}
          </div>
        ) : (
          <div>
            <div
              className="panel-bash"
              style={{ marginBottom: '1rem' }}
            >
              <div className="panel-bash-header">
                <div className="panel-bash-dots">
                  <span className="panel-bash-dot"></span>
                  <span className="panel-bash-dot"></span>
                  <span className="panel-bash-dot"></span>
                </div>
                <span className="panel-bash-title">recipient</span>
              </div>
              <div className="panel-bash-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="avatar"
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: 'var(--sys-primary)',
                      backgroundImage: selectedUser.avatar_url ? `url(${selectedUser.avatar_url})` : undefined,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--sys-text)' }}>{selectedUser.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--sys-text-muted)' }}>@{selectedUser.handle}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="btn btn-sm"
                  style={{ background: 'none' }}
                >
                  <span className="sys-icon sys-icon-x"></span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSend}>
              <textarea
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
                rows={4}
                style={{ width: '100%', resize: 'none', fontFamily: 'var(--sys-font-mono)' }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-glow"
                style={{ marginTop: '1rem', width: '100%' }}
                disabled={!message.trim() || isSending}
              >
                {isSending ? (
                  <>
                    <div className="loading-spinner" style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="sys-icon sys-icon-send" style={{ marginRight: '0.5rem' }}></span>
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={
      <div>
        <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
            New Message
          </h1>
        </header>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    }>
      <NewMessageContent />
    </Suspense>
  )
}
