import { NextRequest, NextResponse } from 'next/server'
import { validateBotRequest, supabaseAdmin } from '@/lib/bot-auth'
import { calculateBankBalance } from '@/lib/bank'
import { getStockPrice } from '@/lib/bank'
import { BankDeposit } from '@/types'

const DEFAULT_SPIT_RESERVE = 500
const DEFAULT_GOLD_RESERVE = 10
const DAILY_SPIT_LIMIT = 100
const DAILY_GOLD_LIMIT = 10

export async function POST(request: NextRequest) {
  const { context, error, status } = await validateBotRequest(request)
  if (!context) return NextResponse.json({ error }, { status })

  const { bot, botUserId } = context

  try {
    const body = await request.json().catch(() => ({}))
    const spitReserve = body.spit_reserve ?? DEFAULT_SPIT_RESERVE
    const goldReserve = body.gold_reserve ?? DEFAULT_GOLD_RESERVE

    // Check idempotency: has a consolidation already happened today?
    const todayKey = `consolidate:${new Date().toISOString().slice(0, 10)}`
    const { data: existingConsolidation } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', botUserId)
      .eq('type', 'transfer_sent')
      .eq('reference_id', bot.owner_id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .limit(1)

    if (existingConsolidation && existingConsolidation.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Already consolidated today',
        idempotent: true,
        spits_sent: 0,
        gold_sent: 0,
      })
    }

    // Fetch bot's wallet balances
    const [creditsRes, goldRes, depositsRes, stockRes] = await Promise.all([
      supabaseAdmin.from('user_credits').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('user_gold').select('balance').eq('user_id', botUserId).single(),
      supabaseAdmin.from('bank_deposits').select('currency, principal, locked_rate, deposited_at, withdrawn').eq('user_id', botUserId),
      supabaseAdmin.from('user_stock_holdings').select('shares').eq('user_id', botUserId).single(),
    ])

    const walletSpits = creditsRes.data?.balance ?? 0
    const walletGold = goldRes.data?.balance ?? 0

    // Calculate bank balance (for informational purposes)
    const deposits = (depositsRes.data ?? []).map((d: Record<string, unknown>) => ({
      ...d,
      principal: Number(d.principal),
      locked_rate: Number(d.locked_rate),
      withdrawn: Number(d.withdrawn),
    })) as BankDeposit[]
    const bankBalance = calculateBankBalance(deposits)

    // Stock value
    const stockShares = Number(stockRes.data?.shares ?? 0)
    const stockValue = stockShares * getStockPrice()

    // Only consolidate from wallet (not bank/stock - datacenter handles withdrawal separately)
    const spitsToSend = Math.max(0, walletSpits - spitReserve)
    const goldToSend = Math.max(0, walletGold - goldReserve)

    // Check daily transfer limits - bot's send AND owner's receive (both capped at 100/day for spits)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [spitsSentRes, goldSentRes, ownerSpitsReceivedRes] = await Promise.all([
      supabaseAdmin
        .from('credit_transactions')
        .select('amount')
        .eq('user_id', botUserId)
        .eq('type', 'transfer_sent')
        .gte('created_at', twentyFourHoursAgo),
      supabaseAdmin
        .from('gold_transactions')
        .select('amount')
        .eq('user_id', botUserId)
        .eq('type', 'transfer_sent')
        .gte('created_at', twentyFourHoursAgo),
      // Also check how much the OWNER has received today — transfer_spits RPC
      // penalizes the sender if recipient is over the 100/day receive limit
      supabaseAdmin
        .from('credit_transactions')
        .select('amount')
        .eq('user_id', bot.owner_id)
        .eq('type', 'transfer_received')
        .gte('created_at', twentyFourHoursAgo),
    ])

    const spitsSentToday = (spitsSentRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0)
    const goldSentToday = (goldSentRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0)
    const ownerSpitsReceivedToday = (ownerSpitsReceivedRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0)

    const spitsSendRemaining = Math.max(0, DAILY_SPIT_LIMIT - spitsSentToday)
    const ownerReceiveRemaining = Math.max(0, DAILY_SPIT_LIMIT - ownerSpitsReceivedToday)
    // Cap by the tighter of send limit and owner's receive limit to avoid HP penalty
    const spitsRemaining = Math.min(spitsSendRemaining, ownerReceiveRemaining)
    const goldRemaining = Math.max(0, DAILY_GOLD_LIMIT - goldSentToday)

    const actualSpitsToSend = Math.min(spitsToSend, spitsRemaining)
    const actualGoldToSend = Math.min(goldToSend, goldRemaining)

    let spitResult = null
    let goldResult = null

    // Transfer spits to owner
    if (actualSpitsToSend > 0) {
      const { data, error: rpcErr } = await supabaseAdmin.rpc('transfer_spits', {
        p_sender_id: botUserId,
        p_recipient_id: bot.owner_id,
        p_amount: actualSpitsToSend,
      })
      if (rpcErr) {
        console.error('Consolidation spit transfer error:', rpcErr)
      } else {
        spitResult = data
      }
    }

    // Transfer gold to owner
    if (actualGoldToSend > 0) {
      const { data, error: rpcErr } = await supabaseAdmin.rpc('transfer_gold', {
        p_sender_id: botUserId,
        p_recipient_id: bot.owner_id,
        p_amount: actualGoldToSend,
      })
      if (rpcErr) {
        console.error('Consolidation gold transfer error:', rpcErr)
      } else {
        goldResult = data
      }
    }

    return NextResponse.json({
      success: true,
      spits_sent: actualSpitsToSend,
      gold_sent: actualGoldToSend,
      spit_transfer: spitResult,
      gold_transfer: goldResult,
      limits: {
        spits_remaining_today: spitsRemaining - actualSpitsToSend,
        gold_remaining_today: goldRemaining - actualGoldToSend,
      },
      bot_wealth: {
        wallet_spits: walletSpits - actualSpitsToSend,
        wallet_gold: walletGold - actualGoldToSend,
        bank_balance: bankBalance.totalBalance,
        stock_value: Math.round(stockValue * 100) / 100,
        stock_shares: stockShares,
      },
    })
  } catch (err) {
    console.error('Bot consolidation error:', err)
    return NextResponse.json({ error: 'Consolidation failed' }, { status: 500 })
  }
}
