'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'

const supabase = createClient()
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function useDailyChest() {
  const { user } = useAuthStore()
  const { openChestClaimModal } = useModalStore()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!user || checkedRef.current) return
    checkedRef.current = true

    const checkChest = async () => {
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
        openChestClaimModal()
      }
    }

    checkChest()
  }, [user, openChestClaimModal])
}
