'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { SpitWithAuthor } from '@/types'
import { Spit } from '@/components/spit'
import { SpitComposer } from '@/components/spit'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'

const supabase = createClient()

export default function SpitDetailPage() {
  const params = useParams()
  const spitId = params.id as string
  const { user } = useAuthStore()
  const [spit, setSpit] = useState<SpitWithAuthor | null>(null)
  const [replies, setReplies] = useState<SpitWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchSpit = useCallback(async () => {
    const { data } = await supabase
      .from('spits')
      .select(`*, author:users!spits_user_id_fkey(*)`)
      .eq('id', spitId)
      .single()

    if (data) {
      const enriched = await enrichSpitsWithCounts([data], user?.id)
      setSpit(enriched[0] || null)
    }

    // Fetch replies
    const { data: repliesData } = await supabase
      .from('spits')
      .select(`*, author:users!spits_user_id_fkey(*)`)
      .eq('reply_to_id', spitId)
      .order('created_at', { ascending: true })

    const enrichedReplies = await enrichSpitsWithCounts(repliesData || [], user?.id)
    setReplies(enrichedReplies)
    setIsLoading(false)
  }, [spitId, user?.id])

  useEffect(() => {
    fetchSpit()
  }, [fetchSpit])

  // Listen for replies posted from the modal
  useEffect(() => {
    const handleReplyPosted = (e: CustomEvent<{ replyToId: string }>) => {
      if (e.detail?.replyToId === spitId) {
        fetchSpit()
      }
    }

    window.addEventListener('spit-reply-posted', handleReplyPosted as EventListener)
    return () => {
      window.removeEventListener('spit-reply-posted', handleReplyPosted as EventListener)
    }
  }, [spitId, fetchSpit])

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!spit) {
    return (
      <div className="panel-bash" style={{ margin: '1rem' }}>
        <div className="panel-bash-header">
          <div className="panel-bash-dots">
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
          </div>
          <span className="panel-bash-title">error</span>
        </div>
        <div className="panel-bash-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--sys-danger)' }}>Spit not found</h2>
          <p style={{ color: 'var(--sys-text-muted)' }}>This spit may have been deleted</p>
          <Link href="/" className="btn btn-primary btn-glow" style={{ marginTop: '1rem' }}>
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="feed-header">
        <Link href="/" style={{ color: 'var(--sys-text-muted)', marginRight: '1rem' }}>
          <span className="sys-icon sys-icon-arrow-left"></span>
        </Link>
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          Spit
        </h1>
      </header>

      {/* Main Spit - expanded view */}
      <div className="spit-detail">
        <Spit spit={spit} showActions={true} />
      </div>

      {/* Reply Composer */}
      {user && (
        <div style={{ borderBottom: '1px solid var(--sys-border)' }}>
          <SpitComposer
            replyTo={spit.id}
            onSuccess={fetchSpit}
            placeholder={`Reply to @${spit.author.handle}...`}
          />
        </div>
      )}

      {/* Replies header */}
      {replies.length > 0 && (
        <div className="replies-header">
          <span className="sys-icon sys-icon-message-square"></span>
          <span>Replies ({replies.length})</span>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 ? (
        <div>
          {replies.map((reply) => (
            <Spit key={reply.id} spit={reply} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="sys-icon sys-icon-message-square sys-icon-lg"></span>
          <p>No replies yet</p>
          <p className="empty-state-hint">Be the first to reply!</p>
        </div>
      )}
    </div>
  )
}
