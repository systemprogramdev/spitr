'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCreditCardStore } from '@/stores/creditCardStore'
import { UserCreditCard, CreditCardTransaction } from '@/types'

const supabase = createClient()

export function useCreditCard() {
  const { user } = useAuthStore()
  const { card, transactions, loaded, setCard, setTransactions, setLoaded } = useCreditCardStore()

  const refresh = useCallback(async () => {
    if (!user) return

    const [cardRes, txnRes] = await Promise.all([
      supabase
        .from('user_credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('credit_card_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (cardRes.data) {
      setCard(cardRes.data as unknown as UserCreditCard)

      // Lazy billing cycle processing
      const cycleStart = new Date(cardRes.data.billing_cycle_start).getTime()
      const daysSinceCycle = (Date.now() - cycleStart) / (86400 * 1000)
      if (daysSinceCycle >= 7) {
        try {
          const res = await fetch('/api/credit-card/process-cycle', { method: 'POST' })
          if (res.ok) {
            // Re-fetch card data after processing
            const { data: updated } = await supabase
              .from('user_credit_cards')
              .select('*')
              .eq('user_id', user.id)
              .single()
            if (updated) setCard(updated as unknown as UserCreditCard)

            // Re-fetch transactions too
            const { data: txns } = await supabase
              .from('credit_card_transactions')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(20)
            if (txns) setTransactions(txns as unknown as CreditCardTransaction[])
          }
        } catch {}
      }
    } else {
      setCard(null)
    }

    if (txnRes.data) setTransactions(txnRes.data as unknown as CreditCardTransaction[])
    setLoaded(true)
  }, [user])

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user, refresh])

  return {
    card,
    transactions,
    loaded,
    refresh,
  }
}
