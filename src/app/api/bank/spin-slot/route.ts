import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  spinReels,
  expandWilds,
  evaluateSpin,
  evaluateScatter,
  cascadeWins,
  checkNudge,
  hasBonus,
  runBonusSpins,
  checkProgressiveTrigger,
  checkHoldOpportunity,
  getStreakMultiplier,
  SLOT_BET_LEVELS,
  PROGRESSIVE_CONTRIBUTION,
  PROGRESSIVE_SEEDS,
} from '@/lib/slots'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bet, isFreeSpin, currentStreak } = await request.json()

    if (!SLOT_BET_LEVELS.includes(bet)) {
      return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 })
    }

    const { data: creditData, error: readError } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (readError || !creditData) {
      return NextResponse.json({ error: 'Failed to read balance' }, { status: 500 })
    }

    const actualBet = isFreeSpin ? 0 : bet
    if (!isFreeSpin && creditData.balance < bet) {
      return NextResponse.json({ error: 'Insufficient spits' }, { status: 400 })
    }

    // ---- 1. Spin ----
    const grid = spinReels()

    // ---- 2. Expanding Wilds ----
    const expandedCols = expandWilds(grid)

    // ---- 3. Evaluate (with wild multiplier) ----
    let { wins, totalPayout: baseLinePayout } = evaluateSpin(grid, bet)

    // ---- 4. Nudge ----
    let nudge: { row: number; col: number } | null = null
    const nudgeResult = checkNudge(grid, wins)
    if (nudgeResult) {
      grid[nudgeResult.row][nudgeResult.col] = nudgeResult.newSymbol
      nudge = { row: nudgeResult.row, col: nudgeResult.col }
      const reeval = evaluateSpin(grid, bet)
      wins = reeval.wins
      baseLinePayout = reeval.totalPayout
    }

    // ---- 5. Streak Multiplier (on base payline wins) ----
    const streakMult = getStreakMultiplier(Math.min(currentStreak || 0, 10))
    const linePayout = Math.floor(baseLinePayout * streakMult)

    // ---- 6. Scatter ----
    const scatterResult = evaluateScatter(grid, bet)
    const scatterPayout = scatterResult ? Math.floor(scatterResult.payout * streakMult) : 0

    // ---- 7. Cascading Wins ----
    const { steps: cascades, totalCascadePayout } = cascadeWins(grid, wins, bet)

    // ---- 8. Progressive (symbol-based triggers) ----
    let progressiveWin: { tier: string; amount: number } | null = null
    let jackpotAmounts: { mini: number; major: number; mega: number } | null = null
    let progressivePayout = 0

    if (!isFreeSpin) {
      try {
        const contrib = {
          mini: Math.max(1, Math.floor(bet * PROGRESSIVE_CONTRIBUTION.mini)),
          major: Math.max(1, Math.floor(bet * PROGRESSIVE_CONTRIBUTION.major)),
          mega: Math.max(1, Math.floor(bet * PROGRESSIVE_CONTRIBUTION.mega)),
        }

        const { data: jpData } = await supabaseAdmin
          .from('slot_jackpots')
          .select('mini_pool, major_pool, mega_pool')
          .eq('id', 'global')
          .single()

        if (jpData) {
          let newMini = Number(jpData.mini_pool) + contrib.mini
          let newMajor = Number(jpData.major_pool) + contrib.major
          let newMega = Number(jpData.mega_pool) + contrib.mega

          const tier = checkProgressiveTrigger(grid, wins)

          if (tier === 'mega') {
            progressiveWin = { tier: 'mega', amount: Math.floor(newMega) }
            progressivePayout = Math.floor(newMega)
            newMega = PROGRESSIVE_SEEDS.mega
          } else if (tier === 'major') {
            progressiveWin = { tier: 'major', amount: Math.floor(newMajor) }
            progressivePayout = Math.floor(newMajor)
            newMajor = PROGRESSIVE_SEEDS.major
          } else if (tier === 'mini') {
            progressiveWin = { tier: 'mini', amount: Math.floor(newMini) }
            progressivePayout = Math.floor(newMini)
            newMini = PROGRESSIVE_SEEDS.mini
          }

          await supabaseAdmin
            .from('slot_jackpots')
            .update({
              mini_pool: newMini,
              major_pool: newMajor,
              mega_pool: newMega,
              ...(progressiveWin?.tier === 'mini' && { last_mini_winner: user.id }),
              ...(progressiveWin?.tier === 'major' && { last_major_winner: user.id }),
              ...(progressiveWin?.tier === 'mega' && { last_mega_winner: user.id }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', 'global')

          jackpotAmounts = {
            mini: Math.floor(newMini),
            major: Math.floor(newMajor),
            mega: Math.floor(newMega),
          }
        }
      } catch {
        // Table may not exist yet
      }
    }

    // ---- 9. Bonus ----
    let bonus: {
      spins: number
      grids: number[][][]
      payouts: number[]
      totalPayout: number
    } | null = null
    let bonusPayout = 0
    if (hasBonus(wins)) {
      const result = runBonusSpins(bet)
      bonus = {
        spins: result.grids.length,
        grids: result.grids,
        payouts: result.payouts,
        totalPayout: result.totalBonusPayout,
      }
      bonusPayout = result.totalBonusPayout
    }

    // ---- 10. Hold & Respin opportunity ----
    const holdOption =
      wins.length === 0 && !scatterResult ? checkHoldOpportunity(grid, wins) : null

    // ---- 11. Total payout & balance ----
    const totalPayout = linePayout + scatterPayout + totalCascadePayout + bonusPayout + progressivePayout
    const canGamble = linePayout + scatterPayout + totalCascadePayout > 0 && !bonus

    const netChange = -actualBet + totalPayout
    const newBalance = creditData.balance + netChange

    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Balance update failed' }, { status: 500 })
    }

    return NextResponse.json({
      grid,
      wins,
      totalPayout,
      newBalance,
      nudge,
      bonus,
      progressiveWin,
      jackpotAmounts,
      expandedCols,
      scatterWin: scatterResult,
      cascades,
      holdOption,
      canGamble,
      streakMultiplier: streakMult,
    })
  } catch (error) {
    console.error('Slot spin error:', error)
    return NextResponse.json({ error: 'Spin failed' }, { status: 500 })
  }
}
