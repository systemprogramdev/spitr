'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCreditsStore } from '@/stores/creditsStore'

const supabase = createClient()

// Credit costs
export const CREDIT_COSTS = {
  post: 1,
  reply: 1,
  respit: 1,
  like: 1,
  pin_purchase: 500,
} as const

// Weekly paycheck
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Module-level flag — shared across all hook instances to prevent double-fire
let paycheckChecked = false

export function useCredits() {
  const { user } = useAuthStore()
  const { balance, setBalance, deduct } = useCreditsStore()

  const checkAndApplyWeeklyPaycheck = async (userId: string, currentBalance: number, freeCreditsAt: string | null) => {
    // Only check once per session to avoid race conditions
    if (paycheckChecked) return currentBalance

    paycheckChecked = true

    const lastFreeCredits = freeCreditsAt ? new Date(freeCreditsAt).getTime() : 0
    const now = Date.now()

    // If 7 days have passed since last paycheck
    if (now - lastFreeCredits >= SEVEN_DAYS_MS) {
      try {
        const res = await fetch('/api/paycheck', { method: 'POST' })
        if (res.ok) {
          const { useModalStore } = await import('@/stores/modalStore')
          useModalStore.getState().openPaycheckModal()
        }
      } catch {
        // Silently ignore — server will reject if not eligible
      }
    }

    return currentBalance
  }

  const refreshBalance = async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    if (data) setBalance(data.balance)
  }

  useEffect(() => {
    if (!user) return

    supabase
      .from('user_credits')
      .select('balance, free_credits_at')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const finalBalance = await checkAndApplyWeeklyPaycheck(
            user.id,
            data.balance,
            data.free_credits_at
          )
          setBalance(finalBalance)
        }
      })
  }, [user, setBalance])

  const deductCredit = async (
    type: 'post' | 'reply' | 'respit' | 'like' | 'pin_purchase',
    referenceId?: string
  ) => {
    const cost = CREDIT_COSTS[type]
    // Get real-time balance from store to avoid stale state in sequential calls
    const currentBalance = useCreditsStore.getState().balance
    if (!user || currentBalance < cost) return false

    const newBalance = currentBalance - cost

    const { error } = await supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (error) return false

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      type,
      amount: -cost,
      balance_after: newBalance,
      reference_id: referenceId,
    })

    deduct(cost)
    return true
  }

  // Deduct a custom amount (for images, bulk operations, etc.)
  const deductAmount = async (
    amount: number,
    type: 'post' | 'reply' | 'respit' | 'pin_purchase' | 'convert',
    referenceId?: string
  ) => {
    // Get real-time balance from store to avoid stale state in sequential calls
    const currentBalance = useCreditsStore.getState().balance
    if (!user || currentBalance < amount) return false

    const newBalance = currentBalance - amount

    const { error } = await supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (error) return false

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      type,
      amount: -amount,
      balance_after: newBalance,
      reference_id: referenceId,
    })

    deduct(amount)
    return true
  }

  const addAmount = async (
    amount: number,
    type: 'convert' | 'like_reward' | 'transfer_received',
    referenceId?: string
  ) => {
    const currentBalance = useCreditsStore.getState().balance
    if (!user) return false

    const newBalance = currentBalance + amount

    const { error } = await supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (error) return false

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      type,
      amount,
      balance_after: newBalance,
      reference_id: referenceId,
    })

    setBalance(newBalance)
    return true
  }

  const hasCredits = (amount = 1) => balance >= amount

  return {
    balance,
    deductCredit,
    deductAmount,
    addAmount,
    hasCredits,
    refreshBalance,
  }
}
