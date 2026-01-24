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
  pin_purchase: 500,
} as const

export function useCredits() {
  const { user } = useAuthStore()
  const { balance, setBalance, deduct } = useCreditsStore()

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
      .select('balance')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setBalance(data.balance)
      })
  }, [user, setBalance])

  const deductCredit = async (
    type: 'post' | 'reply' | 'respit' | 'pin_purchase',
    referenceId?: string
  ) => {
    const cost = CREDIT_COSTS[type]
    if (!user || balance < cost) return false

    const newBalance = balance - cost

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
    type: 'post' | 'reply' | 'respit' | 'pin_purchase',
    referenceId?: string
  ) => {
    if (!user || balance < amount) return false

    const newBalance = balance - amount

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
