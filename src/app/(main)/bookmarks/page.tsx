'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { SpitWithAuthor } from '@/types'
import { Spit } from '@/components/spit'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'

const PAGE_SIZE = 20

export default function BookmarksPage() {
  const { user } = useAuthStore()
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const loadingMore = useRef(false)
  const observerRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchBookmarks = useCallback(async (cursor?: string) => {
    if (!user) return
    const isLoadMore = !!cursor
    if (isLoadMore) {
      if (loadingMore.current) return
      loadingMore.current = true
    }

    let query = supabase
      .from('user_bookmarks')
      .select('spit_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (cursor) query = query.lt('created_at', cursor)

    const { data: bookmarks } = await query

    if (!bookmarks || bookmarks.length === 0) {
      if (!isLoadMore) setSpits([])
      setHasMore(false)
      setIsLoading(false)
      loadingMore.current = false
      return
    }

    const spitIds = bookmarks.map(b => b.spit_id)
    const { data: spitsData } = await supabase
      .from('spits')
      .select('*, author:users!spits_user_id_fkey(*)')
      .in('id', spitIds)

    if (spitsData) {
      const spitsMap = new Map(spitsData.map(s => [s.id, s]))
      const ordered = spitIds.map(id => spitsMap.get(id)).filter(Boolean)
      const enriched = await enrichSpitsWithCounts(ordered as any[], user.id)

      if (isLoadMore) {
        setSpits((prev) => [...prev, ...enriched])
      } else {
        setSpits(enriched)
      }
    }

    setHasMore(bookmarks.length >= PAGE_SIZE)
    setIsLoading(false)
    loadingMore.current = false
  }, [user, supabase])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore.current || spits.length === 0) return
    // Use the created_at from the last bookmark — approximate with last spit's created_at
    const lastSpit = spits[spits.length - 1]
    if (!lastSpit) return
    fetchBookmarks(lastSpit.created_at)
  }, [hasMore, spits, fetchBookmarks])

  useEffect(() => {
    const node = observerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-bookmark" style={{ marginRight: '0.5rem' }}></span>
          Bookmarks
        </h1>
      </header>

      {isLoading && spits.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : spits.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}>&#x1F516;</span>
          <p style={{ color: 'var(--sys-text-muted)' }}>No bookmarks yet. Bookmark spits to save them here.</p>
        </div>
      ) : (
        <div>
          {spits.map((spit) => (
            <Spit key={spit.id} spit={spit} />
          ))}
          <div ref={observerRef} style={{ padding: '1rem', textAlign: 'center' }}>
            {loadingMore.current && <div className="loading-spinner"></div>}
            {!hasMore && spits.length > 0 && (
              <p style={{ color: 'var(--sys-text-muted)', fontFamily: 'var(--sys-font-mono)', fontSize: '0.8rem' }}>
                {'// end of bookmarks'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
