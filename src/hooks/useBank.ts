'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useBankStore } from '@/stores/bankStore'
import { calculateBankBalance } from '@/lib/bank'
import { BankDeposit, UserStockHolding, LotteryTicket, BankCD } from '@/types'

const supabase = createClient()

// Supabase returns NUMERIC columns as strings — parse them to numbers
function parseDeposit(d: Record<string, unknown>): BankDeposit {
  return {
    ...d,
    principal: Number(d.principal),
    locked_rate: Number(d.locked_rate),
    withdrawn: Number(d.withdrawn),
  } as BankDeposit
}

function parseHolding(h: Record<string, unknown>): UserStockHolding {
  return {
    ...h,
    shares: Number(h.shares),
    total_cost_basis: Number(h.total_cost_basis),
  } as UserStockHolding
}

function parseTicket(t: Record<string, unknown>): LotteryTicket {
  return {
    ...t,
    cost_amount: Number(t.cost_amount),
    prize_amount: Number(t.prize_amount),
  } as LotteryTicket
}

function parseCD(c: Record<string, unknown>): BankCD {
  return {
    ...c,
    principal: Number(c.principal),
    rate: Number(c.rate),
    term_days: Number(c.term_days),
  } as BankCD
}

export function useBank() {
  const { user } = useAuthStore()
  const {
    spitDeposits,
    goldDeposits,
    stockHolding,
    unscratchedTickets,
    activeCDs,
    loaded,
    setSpitDeposits,
    setGoldDeposits,
    setStockHolding,
    setUnscratchedTickets,
    setActiveCDs,
    setLoaded,
  } = useBankStore()

  const refresh = async () => {
    if (!user) return

    const [depositsRes, holdingRes, ticketsRes, cdsRes] = await Promise.all([
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
      supabase
        .from('bank_cds')
        .select('*')
        .eq('user_id', user.id)
        .eq('redeemed', false)
        .order('created_at', { ascending: false }),
    ])

    if (depositsRes.data) {
      const parsed = depositsRes.data.map(parseDeposit)
      setSpitDeposits(parsed.filter(d => d.currency === 'spit'))
      setGoldDeposits(parsed.filter(d => d.currency === 'gold'))
    }
    setStockHolding(holdingRes.data ? parseHolding(holdingRes.data as Record<string, unknown>) : null)
    if (ticketsRes.data) setUnscratchedTickets(ticketsRes.data.map(t => parseTicket(t as Record<string, unknown>)))
    if (cdsRes.data) setActiveCDs(cdsRes.data.map(c => parseCD(c as Record<string, unknown>)))
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
    activeCDs,
    loaded,
    refresh,
    getSpitBankBalance,
    getGoldBankBalance,
  }
}
