'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'

const supabase = createClient()
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // Re-check every hour

export function useDailyChest() {
  const { user } = useAuthStore()
  const { openChestClaimModal } = useModalStore()
  const shownRef = useRef(false)

  useEffect(() => {
    if (!user) return

    const checkChest = async () => {
      // Don't show again if already shown this session and not dismissed
      if (shownRef.current) return

      const { data } = await supabase
        .from('users')
        .select('last_chest_claimed_at')
        .eq('id', user.id)
        .single()

      if (!data) return

      const lastClaimed = data.last_chest_claimed_at
        ? new Date(data.last_chest_claimed_at).getTime()
        : 0
      const now = Date.now()

      if (now - lastClaimed >= TWENTY_FOUR_HOURS_MS) {
        shownRef.current = true
        openChestClaimModal()
      }
    }

    // Check immediately on mount
    checkChest()

    // Re-check every hour for long sessions
    const interval = setInterval(() => {
      shownRef.current = false
      checkChest()
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [user, openChestClaimModal])
}
