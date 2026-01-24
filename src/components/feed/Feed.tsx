'use client'

import { useEffect, useRef } from 'react'
import { Spit } from '@/components/spit'
import { SpitWithAuthor } from '@/types'

interface PinnedSpitWithData extends SpitWithAuthor {
  _pinId?: string
}

interface FeedProps {
  spits: SpitWithAuthor[]
  pinnedSpits?: PinnedSpitWithData[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onRefresh?: () => void
  onDismissPin?: (pinId: string) => void
}

export function Feed({ spits, pinnedSpits = [], isLoading, hasMore, onLoadMore, onDismissPin }: FeedProps) {
  const observerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  if (isLoading && spits.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--sys-text-muted)' }}>Loading feed...</p>
      </div>
    )
  }

  if (spits.length === 0 && pinnedSpits.length === 0) {
    return (
      <div className="panel-bash" style={{ margin: '1rem' }}>
        <div className="panel-bash-header">
          <div className="panel-bash-dots">
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
            <span className="panel-bash-dot"></span>
          </div>
          <span className="panel-bash-title">feed</span>
        </div>
        <div className="panel-bash-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--sys-text-muted)' }}>
            No spits yet. Be the first to post!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Promoted Spits */}
      {pinnedSpits.map((spit) => (
        <div key={spit.id} className="promoted-spit">
          <div className="promoted-spit-header">
            <div className="promoted-spit-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>PROMOTED</span>
            </div>
            {onDismissPin && spit._pinId && (
              <button
                className="promoted-spit-dismiss"
                onClick={() => onDismissPin(spit._pinId!)}
                title="Dismiss"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <div className="promoted-spit-glow"></div>
          <Spit spit={spit} />
        </div>
      ))}

      {/* Regular Spits */}
      {spits.map((spit) => (
        <Spit key={spit.id} spit={spit} />
      ))}

      <div ref={observerRef} style={{ padding: '1rem', textAlign: 'center' }}>
        {isLoading && <div className="loading-spinner"></div>}
        {!hasMore && spits.length > 0 && (
          <p style={{ color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)', fontSize: '0.8rem' }}>
            {'// end of feed'}
          </p>
        )}
      </div>
    </div>
  )
}
