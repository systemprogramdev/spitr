'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useBankStore } from '@/stores/bankStore'
import { calculateBankBalance } from '@/lib/bank'

const supabase = createClient()

export function useBank() {
  const { user } = useAuthStore()
  const {
    spitDeposits,
    goldDeposits,
    stockHolding,
    unscratchedTickets,
    loaded,
    setSpitDeposits,
    setGoldDeposits,
    setStockHolding,
    setUnscratchedTickets,
    setLoaded,
  } = useBankStore()

  const refresh = async () => {
    if (!user) return

    const [depositsRes, holdingRes, ticketsRes] = await Promise.all([
      supabase
        .from('bank_deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('deposited_at', { ascending: false }),
      supabase
        .from('user_stock_holdings')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('lottery_tickets')
        .select('*')
        .eq('user_id', user.id)
        .eq('scratched', false)
        .order('created_at', { ascending: false }),
    ])

    if (depositsRes.data) {
      setSpitDeposits(depositsRes.data.filter(d => d.currency === 'spit'))
      setGoldDeposits(depositsRes.data.filter(d => d.currency === 'gold'))
    }
    setStockHolding(holdingRes.data || null)
    if (ticketsRes.data) setUnscratchedTickets(ticketsRes.data)
    setLoaded(true)
  }

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user])

  const getSpitBankBalance = (now: Date = new Date()) =>
    calculateBankBalance(spitDeposits, now)

  const getGoldBankBalance = (now: Date = new Date()) =>
    calculateBankBalance(goldDeposits, now)

  return {
    spitDeposits,
    goldDeposits,
    stockHolding,
    unscratchedTickets,
    loaded,
    refresh,
    getSpitBankBalance,
    getGoldBankBalance,
  }
}
