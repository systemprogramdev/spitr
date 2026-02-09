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
    // Financial Advisor
    // ============================================

    const walletSpits = creditsRes.data?.balance ?? 0
    const walletGold = goldRes.data?.balance ?? 0

    // Daily transfer totals
    const spitsSentToday = (spitTransfersRes.data ?? []).reduce((sum: number, t: { amount: unknown }) => sum + Math.abs(Number(t.amount)), 0)
    const goldSentToday = (goldTransfersRes.data ?? []).reduce((sum: number, t: { amount: unknown }) => sum + Math.abs(Number(t.amount)), 0)

    // --- CD Recommendations ---
    const nowMs = now.getTime()
    const cdStaggerMs = CD_STAGGER_DAYS * 24 * 60 * 60 * 1000
    const sevenDayTier = CD_TIERS.find(t => t.termDays === 7)!

    // Redeemable CDs (matured)
    const redeemableCDs = activeCDs
      .filter(cd => new Date(cd.matures_at).getTime() <= nowMs)
      .map(cd => ({
        id: cd.id,
        currency: cd.currency,
        principal: cd.amount,
        payout: Math.floor(cd.amount * (1 + cd.rate) * 100000) / 100000,
      }))

    // Active (not yet matured) CDs split by currency
    const activeSpitCDs = activeCDs.filter(cd => cd.currency === 'spit' && new Date(cd.matures_at).getTime() > nowMs)
    const activeGoldCDs = activeCDs.filter(cd => cd.currency === 'gold' && new Date(cd.matures_at).getTime() > nowMs)

    // Check stagger: any active CD maturing within CD_STAGGER_DAYS?
    const hasSpitCDMaturingSoon = activeSpitCDs.some(cd => new Date(cd.matures_at).getTime() - nowMs < cdStaggerMs)
    const hasGoldCDMaturingSoon = activeGoldCDs.some(cd => new Date(cd.matures_at).getTime() - nowMs < cdStaggerMs)

    // Spit CD recommendation
    const availableSpits = walletSpits - SPIT_RESERVE - SPIT_BUFFER
    const hasRedeemableSpitCD = redeemableCDs.some(cd => cd.currency === 'spit')
    let spitCdRec: { action: string; amount: number; reason: string }
    if (hasRedeemableSpitCD) {
      const total = redeemableCDs.filter(cd => cd.currency === 'spit').reduce((s, cd) => s + cd.payout, 0)
      spitCdRec = { action: 'redeem', amount: Math.floor(total), reason: `${redeemableCDs.filter(cd => cd.currency === 'spit').length} matured spit CD(s) ready` }
    } else if (availableSpits >= 100 && !hasSpitCDMaturingSoon) {
      const amt = Math.floor(availableSpits)
      spitCdRec = { action: 'buy', amount: amt, reason: `7-day CD at ${sevenDayTier.rate * 100}% beats bank rate (~1.43%/day vs 0.5-1%/day)` }
    } else if (hasSpitCDMaturingSoon) {
      spitCdRec = { action: 'wait', amount: 0, reason: 'Active spit CD matures within 3 days — wait to redeem and re-invest' }
    } else {
      spitCdRec = { action: 'wait', amount: 0, reason: `Insufficient spits above ${SPIT_RESERVE + SPIT_BUFFER} reserve (have ${walletSpits})` }
    }

    // Gold CD recommendation
    const availableGold = walletGold - GOLD_RESERVE
    const hasRedeemableGoldCD = redeemableCDs.some(cd => cd.currency === 'gold')
    let goldCdRec: { action: string; amount: number; reason: string }
    if (hasRedeemableGoldCD) {
      const total = redeemableCDs.filter(cd => cd.currency === 'gold').reduce((s, cd) => s + cd.payout, 0)
      goldCdRec = { action: 'redeem', amount: Math.floor(total * 100000) / 100000, reason: `${redeemableCDs.filter(cd => cd.currency === 'gold').length} matured gold CD(s) ready` }
    } else if (availableGold >= 10 && !hasGoldCDMaturingSoon) {
      const amt = Math.floor(availableGold)
      goldCdRec = { action: 'buy', amount: amt, reason: `7-day CD at ${sevenDayTier.rate * 100}% return` }
    } else if (hasGoldCDMaturingSoon) {
      goldCdRec = { action: 'wait', amount: 0, reason: 'Active gold CD matures within 3 days — wait to redeem and re-invest' }
    } else {
      goldCdRec = { action: 'wait', amount: 0, reason: `Insufficient gold above ${GOLD_RESERVE} reserve (have ${walletGold})` }
    }

    // --- Conversion Recommendation ---
    const excessSpits = walletSpits - SPIT_RESERVE - SPIT_BUFFER
    const convertAmount = Math.floor(excessSpits / SPIT_TO_GOLD_RATIO) * SPIT_TO_GOLD_RATIO
    const shouldConvert = convertAmount >= 10
    const conversion = {
      should_convert: shouldConvert,
      direction: 'spits_to_gold' as const,
      amount: shouldConvert ? convertAmount : 0,
      gold_received: shouldConvert ? convertAmount / SPIT_TO_GOLD_RATIO : 0,
      reason: shouldConvert
        ? `Excess spits above ${SPIT_RESERVE + SPIT_BUFFER} reserve`
        : `Spits (${walletSpits}) below ${SPIT_RESERVE + SPIT_BUFFER} + 10 conversion minimum`,
    }

    // --- Consolidation Readiness ---
    const spitsTransferRemaining = Math.max(0, DAILY_SPIT_TRANSFER_LIMIT - spitsSentToday)
    const goldTransferRemaining = Math.max(0, DAILY_GOLD_TRANSFER_LIMIT - goldSentToday)
    const spitsAvailableToConsolidate = Math.min(Math.max(0, walletSpits - SPIT_RESERVE), spitsTransferRemaining)
    const goldAvailableToConsolidate = Math.min(Math.max(0, walletGold - GOLD_RESERVE), goldTransferRemaining)
    const consolidationReady = spitsAvailableToConsolidate > 0 || goldAvailableToConsolidate > 0
    const consolidation = {
      ready: consolidationReady,
      spits_available: spitsAvailableToConsolidate,
      gold_available: goldAvailableToConsolidate,
      daily_spit_limit_remaining: spitsTransferRemaining,
      daily_gold_limit_remaining: goldTransferRemaining,
      reason: consolidationReady
        ? 'Wallet exceeds reserves, daily limits available'
        : spitsTransferRemaining === 0 && goldTransferRemaining === 0
          ? 'Daily transfer limits exhausted'
          : 'Wallet at or below reserves',
    }

    // --- Priority Queue & Next Action ---
    const priorityQueue: string[] = []
    if (redeemableCDs.length > 0) priorityQueue.push('redeem_cd')
    if (shouldConvert) priorityQueue.push('convert_spits')
    if (spitCdRec.action === 'buy') priorityQueue.push('buy_spit_cd')
    if (goldCdRec.action === 'buy') priorityQueue.push('buy_gold_cd')
    if (rateSignal === 'bank') priorityQueue.push('deposit_at_peak_rate')
    if (depositsOver24h.length > 0) priorityQueue.push('withdraw_matured_deposits')
    if (consolidationReady) priorityQueue.push('consolidate')

    const nextAction = priorityQueue[0] ?? 'hold'
    let nextActionDetail: string
    switch (nextAction) {
      case 'redeem_cd': {
        const spitPayout = redeemableCDs.filter(cd => cd.currency === 'spit').reduce((s, cd) => s + cd.payout, 0)
        const goldPayout = redeemableCDs.filter(cd => cd.currency === 'gold').reduce((s, cd) => s + cd.payout, 0)
        const parts = []
        if (spitPayout > 0) parts.push(`${Math.floor(spitPayout)} spits`)
        if (goldPayout > 0) parts.push(`${Math.floor(goldPayout * 100) / 100} gold`)
        nextActionDetail = `Redeem ${redeemableCDs.length} matured CD(s) worth ${parts.join(' and ')}`
        break
      }
      case 'convert_spits':
        nextActionDetail = `Convert ${convertAmount} spits to ${convertAmount / SPIT_TO_GOLD_RATIO} gold`
        break
      case 'buy_spit_cd':
        nextActionDetail = `Buy 7-day spit CD with ${spitCdRec.amount} spits`
        break
      case 'buy_gold_cd':
        nextActionDetail = `Buy 7-day gold CD with ${goldCdRec.amount} gold`
        break
      case 'deposit_at_peak_rate':
        nextActionDetail = `Bank rate at ${Math.round(ratePercent * 100) / 100}% — deposit to lock in high rate`
        break
      case 'withdraw_matured_deposits':
        nextActionDetail = `${depositsOver24h.length} deposit(s) matured and ready for withdrawal`
        break
      case 'consolidate':
        nextActionDetail = `Transfer ${spitsAvailableToConsolidate} spits and ${goldAvailableToConsolidate} gold to owner`
        break
      default:
        nextActionDetail = 'No immediate actions — portfolio is optimized'
    }

    const financialAdvisor = {
      cds: {
        redeemable_cds: redeemableCDs,
        spit_cd: spitCdRec,
        gold_cd: goldCdRec,
      },
      conversion,
      consolidation,
      strategy: {
        next_action: nextAction,
        detail: nextActionDetail,
        priority_queue: priorityQueue,
      },
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
