import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { getMaxHp } from '@/lib/items'
import { xpForLevel } from '@/lib/xp'
import { calculateBankBalance, calculateInterest, getCurrentDailyRate, getStockPrice } from '@/lib/bank'
import { BankDeposit } from '@/types'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const [userRes, creditsRes, goldRes, xpRes, inventoryRes, depositsRes, buffsRes, stockRes, cdsRes, configRes] = await Promise.all([
      supabaseAdmin.from('users').select('hp, is_destroyed, last_chest_claimed_at').eq('id', botUserId).single(),
      supabaseAdmin.from('user_credits').select('balance, free_credits_at').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_gold').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_xp').select('xp, level').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_inventory').select('item_type, quantity').eq('user_id', botUserId),
      supabaseAdmin.from('bank_deposits').select('id, currency, principal, locked_rate, deposited_at, withdrawn').eq('user_id', botUserId),
      supabaseAdmin.from('user_buffs').select('buff_type, charges_remaining').eq('user_id', botUserId),
      supabaseAdmin.from('user_stock_holdings').select('shares').eq('user_id', botUserId).single(),
      supabaseAdmin.from('bank_cds').select('id, principal, rate, term_days, created_at').eq('user_id', botUserId).eq('redeemed', false),
      supabaseAdmin.from('bots').select('bot_configs(banking_strategy)').eq('user_id', botUserId).single(),
    ])

    const level = xpRes.data?.level ?? 1
    const xp = xpRes.data?.xp ?? 0
    const maxHp = getMaxHp(level)

    // Daily chest availability
    const lastClaimed = userRes.data?.last_chest_claimed_at
      ? new Date(userRes.data.last_chest_claimed_at).getTime()
      : 0
    const dailyChestAvailable = Date.now() - lastClaimed >= TWENTY_FOUR_HOURS_MS

    // Weekly paycheck availability
    const lastPaycheck = creditsRes.data?.free_credits_at
      ? new Date(creditsRes.data.free_credits_at).getTime()
      : 0
    const weeklyPaycheckAvailable = Date.now() - lastPaycheck >= SEVEN_DAYS_MS

    // Defense buffs
    const buffs = buffsRes.data ?? []
    const firewall = buffs.find((b: { buff_type: string }) => b.buff_type === 'firewall')
    const kevlar = buffs.find((b: { buff_type: string }) => b.buff_type === 'kevlar')

    // Bank balance (pre-computed)
    const deposits = (depositsRes.data ?? []).map((d: Record<string, unknown>) => ({
      ...d,
      principal: Number(d.principal),
      locked_rate: Number(d.locked_rate),
      withdrawn: Number(d.withdrawn),
    })) as BankDeposit[]
    const bankBalance = calculateBankBalance(deposits)

    // Active CDs with maturity dates
    const activeCDs = (cdsRes.data ?? []).map((c: { id: string; principal: unknown; rate: unknown; term_days: unknown; created_at: string }) => {
      const termDays = Number(c.term_days)
      const maturesAt = new Date(new Date(c.created_at).getTime() + termDays * 24 * 60 * 60 * 1000).toISOString()
      return {
        id: c.id,
        amount: Number(c.principal),
        term: termDays,
        matures_at: maturesAt,
      }
    })

    // Market data
    const now = new Date()
    const currentRate = getCurrentDailyRate(now)
    const stockPrice = getStockPrice(now)
    const ratePercent = currentRate * 100
    const rateSignal = ratePercent >= 0.85 ? 'bank' : 'trade'

    // Suggested action based on market
    let suggestedAction: string
    if (rateSignal === 'bank') {
      suggestedAction = 'deposit'
    } else {
      // Check if there are matured deposits to withdraw
      const hasMaturedDeposits = deposits.some(d => {
        const ageMs = now.getTime() - new Date(d.deposited_at).getTime()
        return ageMs >= TWENTY_FOUR_HOURS_MS
      })
      suggestedAction = hasMaturedDeposits ? 'withdraw_and_invest' : 'hold'
    }

    // Deposits older than 24h with accrued interest
    const depositsOver24h = deposits
      .filter(d => {
        const ageMs = now.getTime() - new Date(d.deposited_at).getTime()
        return ageMs >= TWENTY_FOUR_HOURS_MS
      })
      .map(d => ({
        id: d.id,
        currency: d.currency,
        principal: d.principal,
        locked_rate: d.locked_rate,
        deposited_at: d.deposited_at,
        withdrawn: d.withdrawn,
        accrued_interest: calculateInterest(d.principal, d.locked_rate, d.deposited_at, now),
        current_value: d.principal + calculateInterest(d.principal, d.locked_rate, d.deposited_at, now) - d.withdrawn,
      }))

    // Banking strategy from config
    const botConfigs = configRes.data?.bot_configs as { banking_strategy: string }[] | null
    const bankingStrategy = botConfigs?.[0]?.banking_strategy ?? 'none'

    return NextResponse.json({
      hp: userRes.data?.hp ?? maxHp,
      max_hp: maxHp,
      destroyed: userRes.data?.is_destroyed ?? false,
      credits: creditsRes.data?.balance ?? 0,
      gold: goldRes.data?.balance ?? 0,
      bank_balance: bankBalance.totalBalance,
      xp,
      level,
      xp_next_level: xpForLevel(level + 1),
      daily_chest_available: dailyChestAvailable,
      weekly_paycheck_available: weeklyPaycheckAvailable,
      has_firewall: !!firewall,
      kevlar_charges: kevlar?.charges_remaining ?? 0,
      stocks_owned: Number(stockRes.data?.shares ?? 0),
      active_cds: activeCDs,
      inventory: inventoryRes.data ?? [],
      bank_deposits: depositsRes.data ?? [],
      deposits_over_24h: depositsOver24h,
      market: {
        current_rate: Math.round(currentRate * 100000) / 100000,
        current_rate_percent: Math.round(ratePercent * 100) / 100,
        rate_signal: rateSignal,
        stock_price: stockPrice,
      },
      suggested_action: suggestedAction,
      banking_strategy: bankingStrategy,
    })
  } catch (err) {
    console.error('Bot status error:', err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
