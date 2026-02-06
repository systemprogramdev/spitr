'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { XP_AMOUNTS } from '@/lib/xp'
import { toast } from '@/stores/toastStore'

const supabase = createClient()

export function useXP() {
  const { user } = useAuthStore()
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchXP = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_xp')
      .select('xp, level')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setXp(data.xp)
      setLevel(data.level)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchXP()
  }, [fetchXP])

  const awardXP = useCallback(
    async (action: string, referenceId?: string) => {
      if (!user) return
      const amount = XP_AMOUNTS[action]
      if (!amount) return

      // Fire-and-forget
      fetch('/api/award-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, referenceId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setXp(data.xp)
            if (data.leveled_up) {
              toast.success(`LEVEL UP! You're now Level ${data.level}! +100 Spits, +10 Gold, +1 Chest, HP fully restored!`)
            }
            setLevel(data.level)
          }
        })
        .catch(() => {})
    },
    [user]
  )

  return { xp, level, loading, awardXP, refreshXP: fetchXP }
}
