'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { SpitWithAuthor } from '@/types'
import { enrichSpitsWithCounts } from '@/lib/spitUtils'

const supabase = createClient()
const PAGE_SIZE = 20

interface PinnedSpitData {
  id: string
  spit_id: string
  expires_at: string
  spit: SpitWithAuthor
  dismissed: boolean
}

export function useFeed() {
  const { user } = useAuthStore()
  const [spits, setSpits] = useState<SpitWithAuthor[]>([])
  const [pinnedSpits, setPinnedSpits] = useState<PinnedSpitData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const loadingMore = useRef(false)

  const fetchFeed = useCallback(async () => {
    setIsLoading(true)

    // Fetch first page of spits
    const { data, error } = await supabase
      .from('spits')
      .select(`
        *,
        author:users!spits_user_id_fkey(*)
      `)
      .is('reply_to_id', null)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (error) {
      console.error('Feed error:', error)
      setIsLoading(false)
      return
    }

    const enriched = await enrichSpitsWithCounts(data || [], user?.id)
    setSpits(enriched)
    setHasMore((data || []).length >= PAGE_SIZE)

    // Fetch active pinned spits (not expired)
    const { data: pinnedData, error: pinnedError } = await supabase
      .from('pinned_spits')
      .select(`
        id,
        spit_id,
        expires_at,
        spit:spits!pinned_spits_spit_id_fkey(*, author:users!spits_user_id_fkey(*))
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (pinnedError) {
      console.error('Error fetching pinned spits:', pinnedError.message)
      setPinnedSpits([])
    } else if (pinnedData && pinnedData.length > 0) {
      // Check which pins the user has already dismissed
      let dismissedPins: string[] = []
      if (user) {
        const { data: viewsData } = await supabase
          .from('pin_views')
          .select('pin_id')
          .eq('user_id', user.id)

        dismissedPins = (viewsData || []).map((v) => v.pin_id)
      }

      const activePins: PinnedSpitData[] = []
      for (const pin of pinnedData) {
        if (dismissedPins.includes(pin.id)) continue // Already dismissed
        if (!pin.spit) continue

        const spitData = pin.spit as any
        const enrichedPin = await enrichSpitsWithCounts([spitData], user?.id)
        if (enrichedPin[0]) {
          activePins.push({
            id: pin.id,
            spit_id: pin.spit_id,
            expires_at: pin.expires_at,
            spit: { ...enrichedPin[0], is_pinned: true },
            dismissed: false,
          })
        }
      }

      setPinnedSpits(activePins)
    } else {
      setPinnedSpits([])
    }

    setIsLoading(false)
  }, [user])

  // Load more spits (cursor-based using created_at of last spit)
  const loadMore = useCallback(async () => {
    if (loadingMore.current || !hasMore) return
    loadingMore.current = true
    setIsLoading(true)

    // Get the oldest spit's timestamp as cursor
    const lastSpit = spits[spits.length - 1]
    if (!lastSpit) {
      loadingMore.current = false
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('spits')
      .select(`
        *,
        author:users!spits_user_id_fkey(*)
      `)
      .is('reply_to_id', null)
      .lt('created_at', lastSpit.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (error) {
      console.error('Load more error:', error)
      loadingMore.current = false
      setIsLoading(false)
      return
    }

    const enriched = await enrichSpitsWithCounts(data || [], user?.id)
    setSpits((prev) => [...prev, ...enriched])
    setHasMore((data || []).length >= PAGE_SIZE)

    loadingMore.current = false
    setIsLoading(false)
  }, [spits, hasMore, user])

  // Dismiss a pinned spit
  const dismissPin = useCallback(async (pinId: string) => {
    // Optimistically hide it
    setPinnedSpits((prev) =>
      prev.map((p) => (p.id === pinId ? { ...p, dismissed: true } : p))
    )

    // Record the dismissal in the database
    if (user) {
      await supabase
        .from('pin_views')
        .insert({ pin_id: pinId, user_id: user.id })
    }
  }, [user])

  // Add spit optimistically (for instant feedback)
  const addOptimisticSpit = useCallback(
    (content: string) => {
      if (!user) return

      const optimisticSpit: SpitWithAuthor = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        content,
        image_url: null,
        reply_to_id: null,
        effect: null,
        hp: 10,
        quote_spit_id: null,
        created_at: new Date().toISOString(),
        author: user,
        like_count: 0,
        respit_count: 0,
        reply_count: 0,
        is_liked: false,
        is_respit: false,
      }

      setSpits((prev) => [optimisticSpit, ...prev])
    },
    [user]
  )

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  // Listen for spit-posted events from the modal
  useEffect(() => {
    const handleSpitPosted = (e: CustomEvent<{ content: string }>) => {
      if (e.detail?.content) {
        addOptimisticSpit(e.detail.content)
      } else {
        fetchFeed()
      }
    }

    const handleSpitPinned = () => {
      fetchFeed()
    }

    window.addEventListener('spit-posted', handleSpitPosted as EventListener)
    window.addEventListener('spit-pinned', handleSpitPinned)
    return () => {
      window.removeEventListener('spit-posted', handleSpitPosted as EventListener)
      window.removeEventListener('spit-pinned', handleSpitPinned)
    }
  }, [addOptimisticSpit, fetchFeed])

  // Visible pinned spits (not dismissed)
  const visiblePinnedSpits = pinnedSpits
    .filter((p) => !p.dismissed)
    .map((p) => ({
      ...p.spit,
      _pinId: p.id,
    }))

  // Get IDs of all pinned spits (including dismissed) to filter from regular feed
  const pinnedSpitIds = new Set(pinnedSpits.map((p) => p.spit_id))

  // Filter out pinned spits from regular feed to avoid duplicates
  const filteredSpits = spits.filter((s) => !pinnedSpitIds.has(s.id))

  return {
    spits: filteredSpits,
    pinnedSpits: visiblePinnedSpits,
    isLoading,
    refresh: fetchFeed,
    dismissPin,
    hasMore,
    loadMore,
  }
}
