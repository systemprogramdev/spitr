'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useGoldStore } from '@/stores/goldStore'

const supabase = createClient()

export function useGold() {
  const { user } = useAuthStore()
  const { balance, setBalance, deduct, add } = useGoldStore()

  const refreshBalance = async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_gold')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    if (data) setBalance(data.balance)
  }

  useEffect(() => {
    if (!user) return

    supabase
      .from('user_gold')
      .select('balance')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBalance(data.balance)
        } else {
          // Initialize gold row if it doesn't exist
          supabase
            .from('user_gold')
            .upsert({ user_id: user.id, balance: 0 })
            .then(() => setBalance(0))
        }
      })
  }, [user, setBalance])

  const deductGold = async (amount: number, type: 'convert' | 'item_purchase', referenceId?: string) => {
    const currentBalance = useGoldStore.getState().balance
    if (!user || currentBalance < amount) return false

    const newBalance = currentBalance - amount

    const { error } = await supabase
      .from('user_gold')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (error) return false

    await supabase.from('gold_transactions').insert({
      user_id: user.id,
      type,
      amount: -amount,
      balance_after: newBalance,
      reference_id: referenceId,
    })

    deduct(amount)
    return true
  }

  const addGold = async (amount: number, type: 'purchase' | 'convert', referenceId?: string) => {
    if (!user) return false

    const currentBalance = useGoldStore.getState().balance
    const newBalance = currentBalance + amount

    const { error } = await supabase
      .from('user_gold')
      .upsert({ user_id: user.id, balance: newBalance })

    if (error) return false

    await supabase.from('gold_transactions').insert({
      user_id: user.id,
      type,
      amount,
      balance_after: newBalance,
      reference_id: referenceId,
    })

    add(amount)
    return true
  }

  const hasGold = (amount = 1) => balance >= amount

  return {
    balance,
    deductGold,
    addGold,
    hasGold,
    refreshBalance,
  }
}
