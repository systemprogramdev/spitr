import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  holdRespin,
  expandWilds,
  evaluateSpin,
  evaluateScatter,
  cascadeWins,
  SLOT_BET_LEVELS,
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

    const { bet, holdCols, currentGrid } = await request.json()

    if (!SLOT_BET_LEVELS.includes(bet)) {
      return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 })
    }

    if (
      !Array.isArray(holdCols) ||
      holdCols.length < 1 ||
      holdCols.length > 2 ||
      !holdCols.every((c: number) => c >= 0 && c <= 2)
    ) {
      return NextResponse.json({ error: 'Invalid hold columns' }, { status: 400 })
    }

    if (
      !Array.isArray(currentGrid) ||
      currentGrid.length !== 3 ||
      !currentGrid.every((r: number[]) => Array.isArray(r) && r.length === 3)
    ) {
      return NextResponse.json({ error: 'Invalid grid' }, { status: 400 })
    }

    const respinCost = Math.floor(bet / 2)

    const { data: creditData, error: readError } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (readError || !creditData) {
      return NextResponse.json({ error: 'Failed to read balance' }, { status: 500 })
    }

    if (creditData.balance < respinCost) {
      return NextResponse.json({ error: 'Insufficient spits for respin' }, { status: 400 })
    }

    // Respin non-held columns
    const grid = holdRespin(currentGrid, holdCols)

    // Expanding wilds on new grid
    const expandedCols = expandWilds(grid)

    // Evaluate
    const { wins, totalPayout: linePayout } = evaluateSpin(grid, bet)

    // Scatter
    const scatterResult = evaluateScatter(grid, bet)
    const scatterPayout = scatterResult?.payout || 0

    // Cascade
    const { steps: cascades, totalCascadePayout } = cascadeWins(grid, wins, bet)

    const totalPayout = linePayout + scatterPayout + totalCascadePayout

    // Balance update
    const netChange = -respinCost + totalPayout
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
      expandedCols,
      scatterWin: scatterResult,
      cascades,
      canGamble: totalPayout > 0,
      respinCost,
    })
  } catch (error) {
    console.error('Respin error:', error)
    return NextResponse.json({ error: 'Respin failed' }, { status: 500 })
  }
}
