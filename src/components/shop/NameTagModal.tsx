'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/stores/toastStore'

const supabase = createClient()

interface SearchUser {
  id: string
  handle: string
  name: string
  avatar_url: string | null
}

interface NameTagModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function NameTagModal({ onClose, onSuccess }: NameTagModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Search users as they type
  useEffect(() => {
    if (!searchTerm.trim() || selectedUser) {
      setSearchResults([])
      return
    }

    const term = searchTerm.replace('@', '').trim()
    if (!term) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const debounce = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, handle, name, avatar_url')
        .or('account_type.neq.sybil,account_type.is.null')
        .ilike('handle', `${term}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      setSearchResults(data || [])
      setHighlightIndex(0)
      setSearching(false)
    }, 150)

    return () => clearTimeout(debounce)
  }, [searchTerm, selectedUser])

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user)
    setSearchTerm('')
    setSearchResults([])
  }

  const handleClearUser = () => {
    setSelectedUser(null)
    setSearchTerm('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % searchResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i - 1 + searchResults.length) % searchResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelectUser(searchResults[highlightIndex])
    } else if (e.key === 'Escape') {
      setSearchResults([])
    }
  }

  const handleSubmit = async () => {
    if (!selectedUser || !customTitle.trim()) {
      toast.warning('Select a user and enter a title.')
      return
    }

    if (customTitle.length > 30) {
      toast.warning('Title must be 30 characters or less.')
      return
    }

    setSending(true)

    const res = await fetch('/api/use-name-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: selectedUser.id,
        customTitle: customTitle.trim(),
      }),
    })

    const data = await res.json()

    if (data.success) {
      toast.success(`Name tag applied: "${data.title}"`)
      onSuccess()
    } else {
      toast.error(data.error || 'Failed to apply name tag.')
    }

    setSending(false)
  }

  return (
    <div className="pin-modal-overlay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
        <div className="pin-modal-header">
          <span style={{ fontSize: '1.25rem' }}>🏷️</span>
          <span>Apply Name Tag</span>
        </div>

        <div className="pin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* User search / selection */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Target user
            </label>

            {selectedUser ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.6rem',
                background: 'var(--sys-surface)',
                border: '1px solid var(--sys-primary)',
                borderRadius: '8px',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: selectedUser.avatar_url ? `url(${selectedUser.avatar_url}) center/cover` : 'var(--sys-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {!selectedUser.avatar_url && selectedUser.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--sys-text)' }}>
                    {selectedUser.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)' }}>
                    @{selectedUser.handle}
                  </div>
                </div>
                <button
                  onClick={handleClearUser}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--sys-text-muted)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                  title="Change user"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search @handle..."
                  autoFocus
                  style={{ width: '100%' }}
                />

                {/* Search results dropdown */}
                {(searchResults.length > 0 || searching) && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--sys-bg)',
                    border: '1px solid var(--sys-border)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    zIndex: 10,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}>
                    {searching ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ width: '16px', height: '16px', margin: '0 auto' }}></div>
                      </div>
                    ) : (
                      searchResults.map((user, index) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          onMouseEnter={() => setHighlightIndex(index)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.5rem 0.6rem',
                            width: '100%',
                            border: 'none',
                            borderBottom: index < searchResults.length - 1 ? '1px solid var(--sys-border)' : 'none',
                            background: index === highlightIndex ? 'rgba(var(--sys-primary-rgb), 0.1)' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--sys-text)',
                            transition: 'background 0.1s',
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: user.avatar_url ? `url(${user.avatar_url}) center/cover` : 'var(--sys-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#fff',
                            flexShrink: 0,
                          }}>
                            {!user.avatar_url && user.name?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)' }}>
                              @{user.handle}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom title input */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Custom title (max 30 chars)
            </label>
            <input
              type="text"
              className="input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.slice(0, 30))}
              placeholder="e.g. Chief Nerd"
              maxLength={30}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--sys-text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
              {customTitle.length}/30
            </div>
          </div>

          {/* Preview with selected user + tag */}
          {selectedUser && customTitle.trim() && (
            <div style={{
              padding: '0.75rem',
              background: 'var(--sys-surface)',
              borderRadius: '8px',
              border: '1px solid var(--sys-border)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--sys-text-muted)', marginBottom: '0.5rem' }}>Preview</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: selectedUser.avatar_url ? `url(${selectedUser.avatar_url}) center/cover` : 'var(--sys-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {!selectedUser.avatar_url && selectedUser.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--sys-text)' }}>
                    {selectedUser.name}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    marginTop: '0.15rem',
                    padding: '0.1rem 0.4rem',
                    fontSize: '0.7rem',
                    fontFamily: 'var(--sys-font-mono)',
                    fontWeight: 700,
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    borderRadius: '4px',
                    color: '#a855f7',
                  }}>
                    🏷️ {customTitle.trim()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={sending || !selectedUser || !customTitle.trim()}
          >
            {sending ? 'Applying...' : 'Apply Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
