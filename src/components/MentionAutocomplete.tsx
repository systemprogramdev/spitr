'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types'

interface MentionAutocompleteProps {
  searchTerm: string
  onSelect: (handle: string) => void
  onClose: () => void
  position: { top: number; left: number }
}

export function MentionAutocomplete({ searchTerm, onSelect, onClose, position }: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const supabase = createClient()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      setUsers([])
      return
    }

    const fetchUsers = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from('users')
        .select('id, handle, name, avatar_url')
        .ilike('handle', `${searchTerm}%`)
        .limit(5)

      setUsers(data || [])
      setSelectedIndex(0)
      setIsLoading(false)
    }

    const debounce = setTimeout(fetchUsers, 150)
    return () => clearTimeout(debounce)
  }, [searchTerm, supabase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % users.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + users.length) % users.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        onSelect(users[selectedIndex].handle)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [users, selectedIndex, onSelect, onClose])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (!searchTerm || (users.length === 0 && !isLoading)) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="mention-autocomplete"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000,
      }}
    >
      {isLoading ? (
        <div className="mention-autocomplete-loading">
          <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
        </div>
      ) : (
        users.map((user, index) => (
          <button
            key={user.id}
            className={`mention-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(user.handle)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div
              className="mention-autocomplete-avatar"
              style={{
                backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : undefined,
              }}
            >
              {!user.avatar_url && user.name?.[0]?.toUpperCase()}
            </div>
            <div className="mention-autocomplete-info">
              <div className="mention-autocomplete-name">{user.name}</div>
              <div className="mention-autocomplete-handle">@{user.handle}</div>
            </div>
          </button>
        ))
      )}
    </div>
  )
}
