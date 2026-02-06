'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCreditsStore } from '@/stores/creditsStore'

const supabase = createClient()

// Credit costs
export const CREDIT_COSTS = {
  post: 1,
  reply: 1,
  respit: 1,
  pin_purchase: 500,
} as const

// Monthly free credits amount
const MONTHLY_FREE_CREDITS = 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function useCredits() {
  const { user } = useAuthStore()
  const { balance, setBalance, deduct } = useCreditsStore()
  const renewalCheckedRef = useRef(false)

  const checkAndApplyMonthlyCredits = async (userId: string, currentBalance: number, freeCreditsAt: string | null) => {
    // Only check once per session to avoid race conditions
    if (renewalCheckedRef.current) return currentBalance

    renewalCheckedRef.current = true

    const lastFreeCredits = freeCreditsAt ? new Date(freeCreditsAt).getTime() : 0
    const now = Date.now()

    // If 30 days have passed since last free credits
    if (now - lastFreeCredits >= THIRTY_DAYS_MS) {
      const newBalance = currentBalance + MONTHLY_FREE_CREDITS

      // Update balance and reset free_credits_at
      const { error } = await supabase
        .from('user_credits')
        .update({
          balance: newBalance,
          free_credits_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (!error) {
        // Log the transaction
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'free_monthly',
          amount: MONTHLY_FREE_CREDITS,
          balance_after: newBalance,
        })

        return newBalance
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
          const finalBalance = await checkAndApplyMonthlyCredits(
            user.id,
            data.balance,
            data.free_credits_at
          )
          setBalance(finalBalance)
        }
      })
  }, [user, setBalance])

  const deductCredit = async (
    type: 'post' | 'reply' | 'respit' | 'pin_purchase',
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

  const hasCredits = (amount = 1) => balance >= amount

  return {
    balance,
    deductCredit,
    deductAmount,
    hasCredits,
    refreshBalance,
  }
}
