'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'
import { useCredits } from '@/hooks/useCredits'
import { SPIT_EFFECTS, EFFECT_COST } from '@/lib/effects'
import { MentionAutocomplete } from '@/components/MentionAutocomplete'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'

const IMAGE_COST = 50

export function SpitModal() {
  const { user } = useAuthStore()
  const { isSpitModalOpen, replyToId, replyToHandle, quoteSpit, closeSpitModal } = useModalStore()
  const { balance, deductCredit, deductAmount, hasCredits } = useCredits()
  const { playSound } = useSound()
  const { awardXP } = useXP()
  const [content, setContent] = useState('')
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null)
  const [showEffects, setShowEffects] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Check for @ mentions while typing
  const checkForMention = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex === -1) {
      setMentionSearch(null)
      return
    }

    const textAfterAt = textBeforeCursor.slice(atIndex + 1)
    if (textAfterAt.includes(' ')) {
      setMentionSearch(null)
      return
    }

    if (atIndex > 0 && !/[\s]/.test(text[atIndex - 1])) {
      setMentionSearch(null)
      return
    }

    setMentionSearch(textAfterAt)
    setMentionStartIndex(atIndex)

    if (textareaRef.current && composerRef.current) {
      const composerRect = composerRef.current.getBoundingClientRect()
      const textareaRect = textareaRef.current.getBoundingClientRect()
      setMentionPosition({
        top: textareaRect.bottom - composerRect.top + 4,
        left: 0,
      })
    }
  }, [])

  const handleMentionSelect = (handle: string) => {
    if (mentionStartIndex === null || !textareaRef.current) return

    const textarea = textareaRef.current
    const cursorPos = textarea.selectionStart
    const beforeMention = content.slice(0, mentionStartIndex)
    const afterCursor = content.slice(cursorPos)

    const newContent = `${beforeMention}@${handle} ${afterCursor}`
    setContent(newContent)
    setMentionSearch(null)
    setMentionStartIndex(null)

    setTimeout(() => {
      const newCursorPos = mentionStartIndex + handle.length + 2
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const charCount = content.length
  const maxChars = 280
  const isOverLimit = charCount > maxChars
  const totalCost = 1 + (selectedEffect ? EFFECT_COST : 0) + (imageFile ? IMAGE_COST : 0)

  useEffect(() => {
    if (isSpitModalOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isSpitModalOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSpitModalOpen) {
        closeSpitModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isSpitModalOpen, closeSpitModal])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be under 5MB')
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user!.id}/${Date.now()}.${fileExt}`

    console.log('Uploading to spit-images bucket:', fileName)

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('spit-images')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError.message, uploadError)
      if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
        setError('Storage bucket "spit-images" not found. Run the storage migration.')
      }
      return null
    }

    console.log('Upload success:', uploadData)

    const { data } = supabase.storage
      .from('spit-images')
      .getPublicUrl(fileName)

    return data.publicUrl
  }

  const handleSubmit = async () => {
    if (!user || !content.trim() || isOverLimit || isLoading) return

    if (!hasCredits(totalCost)) {
      setError(`Insufficient spits! You need ${totalCost} spits.`)
      return
    }

    setIsLoading(true)
    setError('')

    // Upload image FIRST before deducting any credits
    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadImage(imageFile)
      if (!imageUrl) {
        setError('Failed to upload image. Check that storage bucket exists.')
        setIsLoading(false)
        return
      }
    }

    // Now deduct credits after image upload succeeds
    const creditDeducted = await deductCredit(replyToId ? 'reply' : 'post')
    if (!creditDeducted) {
      setError('Failed to process credit. Please try again.')
      setIsLoading(false)
      return
    }

    if (selectedEffect) {
      const effectDeducted = await deductCredit('post')
      if (!effectDeducted) {
        setError('Failed to process effect credit.')
        setIsLoading(false)
        return
      }
    }

    // Deduct image cost after successful upload
    if (imageFile) {
      const imageDeducted = await deductAmount(IMAGE_COST, 'post')
      if (!imageDeducted) {
        setError('Failed to process image credit.')
        setIsLoading(false)
        return
      }
    }

    const insertData: {
      user_id: string
      content: string
      reply_to_id: string | null
      quote_spit_id?: string
      effect?: string
      image_url?: string
    } = {
      user_id: user.id,
      content: content.trim(),
      reply_to_id: replyToId || null,
    }
    if (quoteSpit) {
      insertData.quote_spit_id = quoteSpit.id
    }
    if (selectedEffect) {
      insertData.effect = selectedEffect
    }
    if (imageUrl) {
      insertData.image_url = imageUrl
    }

    const { data: newSpit, error: insertError } = await supabase
      .from('spits')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError.message, insertError.code)
      setError(`Failed to post: ${insertError.message}`)
    } else {
      // Create notification for reply
      if (replyToId && newSpit) {
        const { data: originalSpit } = await supabase
          .from('spits')
          .select('user_id')
          .eq('id', replyToId)
          .single()

        if (originalSpit && originalSpit.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: originalSpit.user_id,
            type: 'reply',
            actor_id: user.id,
            spit_id: newSpit.id,
          })
        }
      }

      // Parse @mentions and create notifications
      if (newSpit) {
        const mentions = content.match(/@([a-zA-Z0-9_]+)/g)
        if (mentions) {
          const handles = [...new Set(mentions.map(m => m.slice(1).toLowerCase()))]
          for (const handle of handles) {
            const { data: mentionedUser } = await supabase
              .from('users')
              .select('id')
              .ilike('handle', handle)
              .single()

            if (mentionedUser && mentionedUser.id !== user.id) {
              await supabase.from('notifications').insert({
                user_id: mentionedUser.id,
                type: 'mention',
                actor_id: user.id,
                spit_id: newSpit.id,
              })
            }
          }
        }
      }

      // Sound + XP — play sound before closing modal to ensure it fires
      playSound('send')
      awardXP(replyToId ? 'reply' : 'post', newSpit?.id)

      const postedContent = content.trim()
      setContent('')
      setSelectedEffect(null)
      setShowEffects(false)
      setImageFile(null)
      setImagePreview(null)
      // Small delay so the sound has time to start playing before unmount
      setTimeout(() => closeSpitModal(), 50)

      // Dispatch appropriate event
      if (replyToId) {
        window.dispatchEvent(new CustomEvent('spit-reply-posted', { detail: { replyToId, content: postedContent } }))
      } else {
        window.dispatchEvent(new CustomEvent('spit-posted', { detail: { content: postedContent } }))
      }
    }

    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  if (!isSpitModalOpen || !user) return null

  return (
    <div
      className="modal-overlay spit-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSpitModal()
      }}
    >
      <div
        className="panel-bash glow spit-modal-panel"
      >
        <div className="panel-bash-header">
          <div className="panel-bash-dots">
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
          </div>
          <span className="panel-bash-title">
            {replyToId ? `reply_to_@${replyToHandle}` : quoteSpit ? 'quote_respit' : 'new_spit'} [{balance} spits]
          </span>
          <button
            onClick={closeSpitModal}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--sys-text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <span className="sys-icon sys-icon-x"></span>
          </button>
        </div>
        <div className="panel-bash-body" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div
              className="avatar"
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--sys-primary)',
                backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : undefined,
                flexShrink: 0,
              }}
            />
            <div ref={composerRef} style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  checkForMention(e.target.value, e.target.selectionStart)
                }}
                onKeyDown={handleKeyDown}
                onSelect={(e) => {
                  checkForMention(content, (e.target as HTMLTextAreaElement).selectionStart)
                }}
                placeholder={replyToId ? `Reply to @${replyToHandle}...` : quoteSpit ? 'Add your comment...' : "What's happening?"}
                rows={4}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--sys-text)',
                  fontFamily: 'var(--sys-font-mono)',
                  fontSize: '1rem',
                }}
              />

              {mentionSearch !== null && (
                <MentionAutocomplete
                  searchTerm={mentionSearch}
                  onSelect={handleMentionSelect}
                  onClose={() => setMentionSearch(null)}
                  position={mentionPosition}
                />
              )}

              {quoteSpit && (
                <div className="quoted-spit-card" style={{ marginTop: '0.5rem' }}>
                  <div className="quoted-spit-header">
                    <div
                      className="avatar"
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundImage: quoteSpit.author.avatar_url
                          ? `url(${quoteSpit.author.avatar_url})`
                          : undefined,
                        flexShrink: 0,
                      }}
                    >
                      {!quoteSpit.author.avatar_url && (
                        <span style={{ fontSize: '0.55rem' }}>{quoteSpit.author.name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <span className="quoted-spit-name">{quoteSpit.author.name}</span>
                    <span className="quoted-spit-handle">@{quoteSpit.author.handle}</span>
                  </div>
                  <p className="quoted-spit-text">{quoteSpit.content}</p>
                </div>
              )}

              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '0.5rem', display: 'inline-block' }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      borderRadius: '8px',
                      border: '1px solid var(--sys-border)',
                    }}
                  />
                  <button
                    onClick={removeImage}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--sys-danger)',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {error && (
                <div className="alert alert-danger" style={{ marginTop: '0.5rem', padding: '0.5rem' }}>
                  {error}
                </div>
              )}

              {showEffects && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--sys-bg)',
                  borderRadius: '4px',
                  border: '1px solid var(--sys-border)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)' }}>
                      SELECT EFFECT (+{EFFECT_COST} spit)
                    </span>
                    {selectedEffect && (
                      <button
                        onClick={() => setSelectedEffect(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--sys-danger)',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          fontFamily: 'var(--sys-font-mono)',
                        }}
                      >
                        [CLEAR]
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {SPIT_EFFECTS.map((effect) => (
                      <button
                        key={effect.id}
                        onClick={() => setSelectedEffect(selectedEffect === effect.id ? null : effect.id)}
                        className={selectedEffect === effect.id ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                        title={effect.description}
                      >
                        {effect.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="spit-modal-toolbar">
                <div className="spit-modal-toolbar-left">
                  <span
                    style={{
                      fontSize: '0.875rem',
                      color: isOverLimit ? 'var(--sys-danger)' : 'var(--sys-text-muted)',
                    }}
                  >
                    {charCount}/{maxChars}
                  </span>
                  {imageFile && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                      +IMG
                    </span>
                  )}
                  {selectedEffect && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                      +FX
                    </span>
                  )}
                  {!hasCredits(totalCost) && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Need {totalCost}</span>}
                </div>

                <div className="spit-modal-toolbar-right">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    title={`Add image (+${IMAGE_COST} spits)`}
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </button>
                  <button
                    className={`btn btn-outline btn-sm ${showEffects ? 'btn-active' : ''}`}
                    onClick={() => setShowEffects(!showEffects)}
                    title="Add effect (+1 spit)"
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={closeSpitModal}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-glow btn-sm"
                    onClick={handleSubmit}
                    disabled={!content.trim() || isOverLimit || isLoading || !hasCredits(totalCost)}
                  >
                    {isLoading ? '...' : replyToId ? 'Reply' : 'Spit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
