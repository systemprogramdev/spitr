import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { getMaxHp, SPIT_TO_GOLD_RATIO } from '@/lib/items'
import { xpForLevel } from '@/lib/xp'
import { calculateBankBalance, calculateInterest, getCurrentDailyRate, getStockPrice, CD_TIERS } from '@/lib/bank'
import { BankDeposit } from '@/types'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Financial advisor constants
const SPIT_RESERVE = 500
const GOLD_RESERVE = 10
const SPIT_BUFFER = 100 // extra for social actions
const DAILY_SPIT_TRANSFER_LIMIT = 100
const DAILY_GOLD_TRANSFER_LIMIT = 10
const CD_STAGGER_DAYS = 3 // don't buy new CD if one matures within 3 days

export async function GET(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { botUserId } = context

  try {
    const twentyFourHoursAgo = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString()

    const [userRes, creditsRes, goldRes, xpRes, inventoryRes, depositsRes, buffsRes, stockRes, cdsRes, configRes, spitTransfersRes, goldTransfersRes] = await Promise.all([
      supabaseAdmin.from('users').select('hp, is_destroyed, last_chest_claimed_at').eq('id', botUserId).single(),
      supabaseAdmin.from('user_credits').select('balance, free_credits_at').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_gold').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_xp').select('xp, level').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_inventory').select('item_type, quantity').eq('user_id', botUserId),
      supabaseAdmin.from('bank_deposits').select('id, currency, principal, locked_rate, deposited_at, withdrawn').eq('user_id', botUserId),
      supabaseAdmin.from('user_buffs').select('buff_type, charges_remaining').eq('user_id', botUserId),
      supabaseAdmin.from('user_stock_holdings').select('shares').eq('user_id', botUserId).single(),
      supabaseAdmin.from('bank_cds').select('id, principal, rate, term_days, created_at, currency, matures_at').eq('user_id', botUserId).eq('redeemed', false),
      supabaseAdmin.from('bots').select('bot_configs(banking_strategy)').eq('user_id', botUserId).single(),
      supabaseAdmin.from('credit_transactions').select('amount').eq('user_id', botUserId).eq('type', 'transfer_sent').gte('created_at', twentyFourHoursAgo),
      supabaseAdmin.from('gold_transactions').select('amount').eq('user_id', botUserId).eq('type', 'transfer_sent').gte('created_at', twentyFourHoursAgo),
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
    const activeCDs = (cdsRes.data ?? []).map((c: { id: string; principal: unknown; rate: unknown; term_days: unknown; created_at: string; currency?: string; matures_at?: string }) => {
      const termDays = Number(c.term_days)
      const maturesAt = c.matures_at ?? new Date(new Date(c.created_at).getTime() + termDays * 24 * 60 * 60 * 1000).toISOString()
      return {
        id: c.id,
        currency: c.currency ?? 'spit',
        amount: Number(c.principal),
        rate: Number(c.rate),
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

    // ============================================
    // Financial Advisor (shaped for datacenter v4)
    // ============================================

    const walletSpits = creditsRes.data?.balance ?? 0
    const walletGold = goldRes.data?.balance ?? 0

    // Daily transfer totals
    const spitsSentToday = (spitTransfersRes.data ?? []).reduce((sum: number, t: { amount: unknown }) => sum + Math.abs(Number(t.amount)), 0)
    const goldSentToday = (goldTransfersRes.data ?? []).reduce((sum: number, t: { amount: unknown }) => sum + Math.abs(Number(t.amount)), 0)

    // --- CD Analysis ---
    const nowMs = now.getTime()
    const cdStaggerMs = CD_STAGGER_DAYS * 24 * 60 * 60 * 1000
    const sevenDayTier = CD_TIERS.find(t => t.termDays === 7)!
    const thirtyDayTier = CD_TIERS.find(t => t.termDays === 30)!

    // Redeemable CDs (matured) — datacenter shape: cd_id, amount, currency, matured, rate, matures_at
    const redeemableCDs = activeCDs
      .filter(cd => new Date(cd.matures_at).getTime() <= nowMs)
      .map(cd => ({
        cd_id: cd.id,
        amount: cd.amount,
        currency: cd.currency,
        matured: true,
        rate: cd.rate,
        matures_at: cd.matures_at,
      }))

    // Active (not yet matured) CDs split by currency
    const activeSpitCDs = activeCDs.filter(cd => cd.currency === 'spit' && new Date(cd.matures_at).getTime() > nowMs)
    const activeGoldCDs = activeCDs.filter(cd => cd.currency === 'gold' && new Date(cd.matures_at).getTime() > nowMs)

    // Check stagger: any active CD maturing within CD_STAGGER_DAYS?
    const hasSpitCDMaturingSoon = activeSpitCDs.some(cd => new Date(cd.matures_at).getTime() - nowMs < cdStaggerMs)
    const hasGoldCDMaturingSoon = activeGoldCDs.some(cd => new Date(cd.matures_at).getTime() - nowMs < cdStaggerMs)

    // CD advice — single object with recommended currency/term
    const availableSpits = walletSpits - SPIT_RESERVE - SPIT_BUFFER
    const availableGold = walletGold - GOLD_RESERVE
    const canBuySpitCD = availableSpits >= 100 && !hasSpitCDMaturingSoon
    const canBuyGoldCD = availableGold >= 10 && !hasGoldCDMaturingSoon

    let recommendedCurrency: 'spit' | 'gold' = 'spit'
    let cdReasoning: string
    if (redeemableCDs.length > 0) {
      cdReasoning = `${redeemableCDs.length} matured CD(s) ready to redeem first`
    } else if (canBuyGoldCD && canBuySpitCD) {
      recommendedCurrency = 'gold'
      cdReasoning = 'Both currencies available — gold CDs compound better after conversion'
    } else if (canBuyGoldCD) {
      recommendedCurrency = 'gold'
      cdReasoning = `${Math.floor(availableGold)} gold available above ${GOLD_RESERVE} reserve`
    } else if (canBuySpitCD) {
      cdReasoning = `${Math.floor(availableSpits)} spits available above ${SPIT_RESERVE + SPIT_BUFFER} reserve`
    } else if (hasSpitCDMaturingSoon || hasGoldCDMaturingSoon) {
      cdReasoning = 'Active CD matures within 3 days — wait to redeem and re-invest'
    } else {
      cdReasoning = 'Insufficient funds above reserves for CD purchase'
    }

    const cdAdvice = {
      recommended_currency: recommendedCurrency,
      recommended_term_days: 7,
      current_spit_rate: sevenDayTier.rate,
      current_gold_rate: sevenDayTier.rate,
      thirty_day_spit_rate: thirtyDayTier.rate,
      thirty_day_gold_rate: thirtyDayTier.rate,
      reasoning: cdReasoning,
    }

    // --- Conversion Advice ---
    const excessSpits = walletSpits - SPIT_RESERVE - SPIT_BUFFER
    const convertAmount = Math.floor(excessSpits / SPIT_TO_GOLD_RATIO) * SPIT_TO_GOLD_RATIO
    const shouldConvert = convertAmount >= 10
    const conversionAdvice = shouldConvert
      ? { direction: 'spits_to_gold' as const, amount: convertAmount, reasoning: `Excess spits above ${SPIT_RESERVE + SPIT_BUFFER} reserve — convert ${convertAmount} spits to ${convertAmount / SPIT_TO_GOLD_RATIO} gold` }
      : null

    // --- Consolidation ---
    const spitsTransferRemaining = Math.max(0, DAILY_SPIT_TRANSFER_LIMIT - spitsSentToday)
    const goldTransferRemaining = Math.max(0, DAILY_GOLD_TRANSFER_LIMIT - goldSentToday)
    const spitSurplus = Math.min(Math.max(0, walletSpits - SPIT_RESERVE), spitsTransferRemaining)
    const goldSurplus = Math.min(Math.max(0, walletGold - GOLD_RESERVE), goldTransferRemaining)
    const consolidationReady = spitSurplus > 0 || goldSurplus > 0

    const consolidation = {
      ready: consolidationReady,
      spit_surplus: spitSurplus,
      gold_surplus: goldSurplus,
    }

    // --- Priority Queue (datacenter shape: array of { action, params, reasoning, priority }) ---
    const priorityQueue: { action: string; params: Record<string, unknown>; reasoning: string; priority: number }[] = []
    let priority = 1

    if (redeemableCDs.length > 0) {
      for (const cd of redeemableCDs) {
        priorityQueue.push({
          action: 'redeem_cd',
          params: { cd_id: cd.cd_id, currency: cd.currency, amount: cd.amount },
          reasoning: `Matured ${cd.currency} CD worth ${Math.floor(cd.amount * (1 + cd.rate) * 100) / 100} ready to redeem`,
          priority: priority++,
        })
      }
    }
    if (shouldConvert) {
      priorityQueue.push({
        action: 'convert_spits',
        params: { amount: convertAmount, direction: 'spits_to_gold' },
        reasoning: `Convert ${convertAmount} excess spits to ${convertAmount / SPIT_TO_GOLD_RATIO} gold`,
        priority: priority++,
      })
    }
    if (canBuySpitCD) {
      priorityQueue.push({
        action: 'buy_spit_cd',
        params: { currency: 'spit', amount: Math.floor(availableSpits), term_days: 7 },
        reasoning: `7-day spit CD at ${sevenDayTier.rate * 100}% beats bank rate (~1.43%/day vs 0.5-1%/day)`,
        priority: priority++,
      })
    }
    if (canBuyGoldCD) {
      priorityQueue.push({
        action: 'buy_gold_cd',
        params: { currency: 'gold', amount: Math.floor(availableGold), term_days: 7 },
        reasoning: `7-day gold CD at ${sevenDayTier.rate * 100}% return`,
        priority: priority++,
      })
    }
    if (rateSignal === 'bank') {
      priorityQueue.push({
        action: 'deposit_at_peak_rate',
        params: { rate_percent: Math.round(ratePercent * 100) / 100 },
        reasoning: `Bank rate at ${Math.round(ratePercent * 100) / 100}% — lock in high rate`,
        priority: priority++,
      })
    }
    if (depositsOver24h.length > 0) {
      priorityQueue.push({
        action: 'withdraw_matured_deposits',
        params: { count: depositsOver24h.length, deposit_ids: depositsOver24h.map(d => d.id) },
        reasoning: `${depositsOver24h.length} deposit(s) matured and ready for withdrawal`,
        priority: priority++,
      })
    }
    if (consolidationReady) {
      priorityQueue.push({
        action: 'consolidate',
        params: { spit_surplus: spitSurplus, gold_surplus: goldSurplus },
        reasoning: `Transfer ${spitSurplus} spits and ${goldSurplus} gold to owner`,
        priority: priority++,
      })
    }
    if (priorityQueue.length === 0) {
      priorityQueue.push({
        action: 'hold',
        params: {},
        reasoning: 'No immediate actions — portfolio is optimized',
        priority: 1,
      })
    }

    const financialAdvisor = {
      priority_queue: priorityQueue,
      redeemable_cds: redeemableCDs,
      cd_advice: cdAdvice,
      conversion_advice: conversionAdvice,
      consolidation,
    }

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
      financial_advisor: financialAdvisor,
    })
  } catch (err) {
    console.error('Bot status error:', err)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
