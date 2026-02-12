'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/stores/toastStore'

const supabase = createClient()

interface NameTagModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function NameTagModal({ onClose, onSuccess }: NameTagModalProps) {
  const [targetHandle, setTargetHandle] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!targetHandle.trim() || !customTitle.trim()) {
      toast.warning('Enter both a handle and a title.')
      return
    }

    if (customTitle.length > 30) {
      toast.warning('Title must be 30 characters or less.')
      return
    }

    setSending(true)

    // Look up user by handle
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .ilike('handle', targetHandle.replace('@', '').trim())
      .single()

    if (!targetUser) {
      toast.error('User not found.')
      setSending(false)
      return
    }

    const res = await fetch('/api/use-name-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: targetUser.id,
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
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
              Target user
            </label>
            <input
              type="text"
              className="input"
              value={targetHandle}
              onChange={(e) => setTargetHandle(e.target.value)}
              placeholder="@handle"
              style={{ width: '100%' }}
            />
          </div>

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

          {/* Preview */}
          {customTitle.trim() && (
            <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--sys-surface)', borderRadius: '6px', border: '1px solid var(--sys-border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--sys-text-muted)', marginBottom: '0.25rem' }}>Preview</div>
              <div style={{
                display: 'inline-block',
                padding: '0.15rem 0.5rem',
                fontSize: '0.75rem',
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
          )}
        </div>

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={sending || !targetHandle.trim() || !customTitle.trim()}
          >
            {sending ? 'Applying...' : 'Apply Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
