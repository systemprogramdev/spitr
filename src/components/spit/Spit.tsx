'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits'
import { useModalStore } from '@/stores/modalStore'
import { SpitWithAuthor } from '@/types'
import { getEffectClassName, getEffectById } from '@/lib/effects'

interface SpitProps {
  spit: SpitWithAuthor & { _respitBy?: string }
  showActions?: boolean
}

export function Spit({ spit, showActions = true }: SpitProps) {
  const { user } = useAuthStore()
  const { deductCredit, hasCredits, balance } = useCredits()
  const { openSpitModal } = useModalStore()
  const [isLiked, setIsLiked] = useState(spit.is_liked)
  const [isRespit, setIsRespit] = useState(spit.is_respit)
  const [likeCount, setLikeCount] = useState(spit.like_count)
  const [respitCount, setRespitCount] = useState(spit.respit_count)
  const [replyCount] = useState(spit.reply_count)
  const [isLoading, setIsLoading] = useState(false)
  const [showLikeAnim, setShowLikeAnim] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [isPinning, setIsPinning] = useState(false)
  const [existingPin, setExistingPin] = useState<{ spit_id: string; expires_at: string } | null>(null)
  const [isCheckingPin, setIsCheckingPin] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const supabase = createClient()
  const isOwnSpit = user?.id === spit.user_id

  const handleDelete = async () => {
    if (!user || isDeleting) return

    setIsDeleting(true)

    const { error } = await supabase
      .from('spits')
      .delete()
      .eq('id', spit.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete error:', error.message)
      alert('Failed to delete spit')
    } else {
      setIsDeleted(true)
      // Dispatch event to refresh feed
      window.dispatchEvent(new CustomEvent('spit-deleted', { detail: { id: spit.id } }))
    }

    setIsDeleting(false)
    setShowDeleteConfirm(false)
  }

  // Don't render if deleted
  if (isDeleted) {
    return null
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || isLoading) return

    // Optimistic update with animation
    setIsLiked(!isLiked)
    setLikeCount(c => isLiked ? c - 1 : c + 1)
    if (!isLiked) {
      setShowLikeAnim(true)
      setTimeout(() => setShowLikeAnim(false), 300)
    }

    setIsLoading(true)

    if (isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('spit_id', spit.id)

      if (error) {
        // Revert on error
        setIsLiked(true)
        setLikeCount(c => c + 1)
      }
    } else {
      const { error } = await supabase.from('likes').insert({
        user_id: user.id,
        spit_id: spit.id,
      })

      if (error) {
        // Revert on error
        setIsLiked(false)
        setLikeCount(c => c - 1)
      } else if (spit.user_id !== user.id) {
        // Create notification for spit owner (not for own spits)
        await supabase.from('notifications').insert({
          user_id: spit.user_id,
          type: 'like',
          actor_id: user.id,
          spit_id: spit.id,
        })
      }
    }

    setIsLoading(false)
  }

  const handleRespit = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || isLoading) return

    if (isRespit) {
      // Optimistic update
      setIsRespit(false)
      setRespitCount(c => c - 1)

      setIsLoading(true)
      const { error } = await supabase
        .from('respits')
        .delete()
        .eq('user_id', user.id)
        .eq('spit_id', spit.id)

      if (error) {
        setIsRespit(true)
        setRespitCount(c => c + 1)
      }
      setIsLoading(false)
    } else {
      if (!hasCredits()) {
        alert('Insufficient spits! Get more credits to respit.')
        return
      }

      // Optimistic update
      setIsRespit(true)
      setRespitCount(c => c + 1)

      setIsLoading(true)
      const credited = await deductCredit('respit', spit.id)
      if (!credited) {
        setIsRespit(false)
        setRespitCount(c => c - 1)
        setIsLoading(false)
        return
      }

      const { error } = await supabase.from('respits').insert({
        user_id: user.id,
        spit_id: spit.id,
      })

      if (error) {
        setIsRespit(false)
        setRespitCount(c => c - 1)
      } else if (spit.user_id !== user.id) {
        // Create notification for spit owner
        await supabase.from('notifications').insert({
          user_id: spit.user_id,
          type: 'respit',
          actor_id: user.id,
          spit_id: spit.id,
        })
      }
      setIsLoading(false)
    }
  }

  const handleReply = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openSpitModal({ id: spit.id, handle: spit.author.handle })
  }

  const handlePinToFeed = async () => {
    if (!user || isPinning) return

    if (!hasCredits(CREDIT_COSTS.pin_purchase)) {
      alert(`Insufficient spits! Pin to Feed costs ${CREDIT_COSTS.pin_purchase} spits.`)
      return
    }

    setIsPinning(true)

    // Deduct credits
    const credited = await deductCredit('pin_purchase', spit.id)
    if (!credited) {
      setIsPinning(false)
      alert('Failed to deduct credits. Please try again.')
      return
    }

    // Create pinned spit (expires in 24 hours)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // First delete any existing pin for this user (RLS doesn't allow update)
    await supabase
      .from('pinned_spits')
      .delete()
      .eq('user_id', user.id)

    // Then insert the new pin
    const { error } = await supabase.from('pinned_spits').insert({
      spit_id: spit.id,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Pin error:', error.message, error.code, error.details)
      alert(`Failed to pin spit: ${error.message}`)
    } else {
      alert('Your spit is now promoted! It will appear at the top of the feed for all users.')
      // Dispatch event to refresh the feed
      window.dispatchEvent(new CustomEvent('spit-pinned'))
    }

    setShowPinModal(false)
    setIsPinning(false)
  }

  return (
    <article className="spit">
      {spit._respitBy && (
        <div className="spit-respit-indicator">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span>@{spit._respitBy} respit</span>
        </div>
      )}
      {spit.is_pinned && (
        <div className="spit-pinned">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>Promoted</span>
        </div>
      )}

      <div className="spit-content">
        <Link href={`/${spit.author.handle}`} className="spit-avatar">
          <div
            className="avatar avatar-glow"
            style={{
              width: '48px',
              height: '48px',
              backgroundImage: spit.author.avatar_url
                ? `url(${spit.author.avatar_url})`
                : undefined,
            }}
          >
            {!spit.author.avatar_url && (
              <span className="avatar-letter">{spit.author.name[0]?.toUpperCase()}</span>
            )}
          </div>
        </Link>

        <div className="spit-body">
          <div className="spit-header">
            <Link href={`/${spit.author.handle}`} className="spit-author">
              {spit.author.name}
            </Link>
            <Link href={`/${spit.author.handle}`} className="spit-handle">
              @{spit.author.handle}
            </Link>
            <span className="spit-dot">·</span>
            <Link href={`/${spit.author.handle}/status/${spit.id}`} className="spit-time">
              {formatDistanceToNow(spit.created_at)}
            </Link>
          </div>

          <Link href={`/${spit.author.handle}/status/${spit.id}`} className="spit-text-link">
            <div className={spit.effect ? getEffectClassName(spit.effect) : ''}>
              <p className="spit-text" data-text={spit.content}>
                {spit.content}
              </p>
            </div>
          </Link>

          {spit.image_url && (
            <div className="spit-image">
              <img src={spit.image_url} alt="" />
            </div>
          )}

          {showActions && (
            <div className="spit-actions">
              {/* Reply */}
              <button
                className="spit-action spit-action-reply"
                onClick={handleReply}
                title="Reply"
              >
                <svg className="spit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                <span className="spit-action-count">{replyCount || ''}</span>
              </button>

              {/* Respit */}
              <button
                className={`spit-action spit-action-respit ${isRespit ? 'active' : ''}`}
                onClick={handleRespit}
                disabled={isLoading}
                title="Respit"
              >
                <svg className="spit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <path d="M7 23l-4-4 4-4"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                <span className="spit-action-count">{respitCount || ''}</span>
              </button>

              {/* Like */}
              <button
                className={`spit-action spit-action-like ${isLiked ? 'active' : ''} ${showLikeAnim ? 'pop' : ''}`}
                onClick={handleLike}
                disabled={isLoading}
                title="Like"
              >
                <svg className="spit-icon" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span className="spit-action-count">{likeCount || ''}</span>
              </button>

              {/* Share */}
              <button
                className="spit-action spit-action-share"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigator.clipboard.writeText(`${window.location.origin}/${spit.author.handle}/status/${spit.id}`)
                }}
                title="Copy link"
              >
                <svg className="spit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </button>

              {/* Pin */}
              {isOwnSpit && !spit.is_pinned && (
                <button
                  className="spit-action spit-action-pin"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!user) return

                    // Check for existing pin
                    setIsCheckingPin(true)
                    const { data: pinData } = await supabase
                      .from('pinned_spits')
                      .select('spit_id, expires_at')
                      .eq('user_id', user.id)
                      .gt('expires_at', new Date().toISOString())
                      .single()

                    setExistingPin(pinData)
                    setIsCheckingPin(false)
                    setShowPinModal(true)
                  }}
                  title="Promote (500 spits)"
                >
                  <svg className="spit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </button>
              )}

              {/* Delete */}
              {isOwnSpit && (
                <button
                  className="spit-action spit-action-delete"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowDeleteConfirm(true)
                  }}
                  title="Delete"
                >
                  <svg className="spit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Pin Modal */}
          {showPinModal && (
            <div
              className="pin-modal-overlay"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowPinModal(false)
              }}
            >
              <div
                className="pin-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pin-modal-header">
                  <svg className="pin-modal-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  <span>Promote Spit</span>
                </div>
                <div className="pin-modal-body">
                  {existingPin && existingPin.spit_id === spit.id ? (
                    <>
                      <p style={{ color: 'var(--sys-accent)' }}>This spit is already promoted!</p>
                      <p className="pin-modal-info">
                        Expires: {new Date(existingPin.expires_at).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p>Promote your spit to appear at the top of everyone&apos;s feed!</p>
                      {existingPin && (
                        <p style={{ color: 'var(--sys-warning, #f59e0b)', marginBottom: '0.5rem' }}>
                          ⚠️ You have an active promotion. This will replace it.
                        </p>
                      )}
                      <div className="pin-modal-cost">
                        <span className="pin-cost-amount">{CREDIT_COSTS.pin_purchase}</span>
                        <span className="pin-cost-label">spits</span>
                      </div>
                      <p className="pin-modal-info">
                        Your spit will be shown for 60 seconds to each user who views the feed.
                        Pin expires after 24 hours.
                      </p>
                      <p className="pin-modal-balance">
                        Your balance: <strong>{balance.toLocaleString()}</strong> spits
                      </p>
                    </>
                  )}
                </div>
                <div className="pin-modal-actions">
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowPinModal(false)}
                  >
                    {existingPin && existingPin.spit_id === spit.id ? 'Close' : 'Cancel'}
                  </button>
                  {!(existingPin && existingPin.spit_id === spit.id) && (
                    <button
                      className="btn btn-primary btn-glow"
                      onClick={handlePinToFeed}
                      disabled={isPinning || !hasCredits(CREDIT_COSTS.pin_purchase)}
                    >
                      {isPinning ? 'Pinning...' : existingPin ? 'Replace Pin' : 'Pin Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div
              className="pin-modal-overlay"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowDeleteConfirm(false)
              }}
            >
              <div
                className="pin-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pin-modal-header" style={{ color: 'var(--sys-danger)' }}>
                  <svg className="pin-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  <span>Delete Spit</span>
                </div>
                <div className="pin-modal-body">
                  <p>Are you sure you want to delete this spit?</p>
                  <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    This action cannot be undone.
                  </p>
                </div>
                <div className="pin-modal-actions">
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    style={{ background: 'var(--sys-danger)', color: 'var(--sys-bg)' }}
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
