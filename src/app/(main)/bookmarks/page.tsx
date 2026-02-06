'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { SpitWithAuthor } from '@/types'
import { Spit } from '@/components/spit'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'

export default function BookmarksPage() {
  const { user } = useAuthStore()
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!user) return

      const { data: bookmarks } = await supabase
        .from('user_bookmarks')
        .select('spit_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!bookmarks || bookmarks.length === 0) {
        setSpits([])
        setIsLoading(false)
        return
      }

      const spitIds = bookmarks.map(b => b.spit_id)
      const { data: spitsData } = await supabase
        .from('spits')
        .select('*, author:users!spits_user_id_fkey(*)')
        .in('id', spitIds)

      if (spitsData) {
        // Maintain bookmark order
        const spitsMap = new Map(spitsData.map(s => [s.id, s]))
        const ordered = spitIds.map(id => spitsMap.get(id)).filter(Boolean)
        const enriched = await enrichSpitsWithCounts(ordered as any[], user.id)
        setSpits(enriched)
      }

      setIsLoading(false)
    }

    fetchBookmarks()
  }, [user, supabase])

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span className="sys-icon sys-icon-bookmark" style={{ marginRight: '0.5rem' }}></span>
          Bookmarks
        </h1>
      </header>

      {isLoading ? (
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
        </div>
      )}
    </div>
  )
}
