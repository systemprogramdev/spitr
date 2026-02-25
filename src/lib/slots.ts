// ============================================
// SLOT MACHINE — Full feature set
// Expanding wilds, scatter, cascading wins, wild multiplier,
// symbol-based progressive triggers, nudge, bonus, hold & respin, gamble, streak
// ============================================

export const WILD_SYMBOL = 7
export const SCATTER_SYMBOL = 8

// Rebalanced for ~93% base RTP — house edge with expanding wilds, cascades, etc.
export const SLOT_SYMBOLS = [
  { id: 1, name: 'Cola', rarity: 'common', payout: 2, weight: 14 },
  { id: 6, name: 'Dice', rarity: 'common', payout: 2, weight: 13 },
  { id: 5, name: 'Blades', rarity: 'common', payout: 2, weight: 11 },
  { id: 3, name: 'Cash', rarity: 'uncommon', payout: 3, weight: 9 },
  { id: 2, name: 'Seven', rarity: 'uncommon', payout: 3, weight: 8 },
  { id: 4, name: 'Bike', rarity: 'rare', payout: 5, weight: 6 },
  { id: 7, name: 'Skull', rarity: 'rare', payout: 8, weight: 2 },
  { id: 8, name: 'Diamond', rarity: 'very_rare', payout: 12, weight: 2 },
  { id: 9, name: 'Jackpot', rarity: 'ultra_rare', payout: 30, weight: 1 },
] as const

export type SlotSymbol = (typeof SLOT_SYMBOLS)[number]

function buildReelStrip(): number[] {
  const strip: number[] = []
  for (const sym of SLOT_SYMBOLS) {
    for (let i = 0; i < sym.weight; i++) strip.push(sym.id)
  }
  return strip
}

export const REEL_STRIP = buildReelStrip()
export const SLOT_BET_LEVELS = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const

export const PAYLINES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2]], // top
  [[1, 0], [1, 1], [1, 2]], // middle
  [[2, 0], [2, 1], [2, 2]], // bottom
  [[0, 0], [1, 1], [2, 2]], // diagonal ↘
  [[2, 0], [1, 1], [0, 2]], // diagonal ↗
]

// ---- Wildcard resolution ----
export function resolvePayline(s0: number, s1: number, s2: number): number | null {
  const syms = [s0, s1, s2]
  const nonWild = syms.filter((s) => s !== WILD_SYMBOL)
  if (nonWild.length === 0) return WILD_SYMBOL
  if (nonWild.every((s) => s === nonWild[0])) return nonWild[0]
  return null
}

// ---- Expanding Wilds ----
// When WILD (7) lands anywhere in a column, fill entire column with WILD
export function expandWilds(grid: number[][]): number[] {
  const expandedCols: number[] = []
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      if (grid[row][col] === WILD_SYMBOL) {
        expandedCols.push(col)
        for (let r = 0; r < 3; r++) grid[r][col] = WILD_SYMBOL
        break
      }
    }
  }
  return expandedCols
}

// ---- Spin ----
export function spinReels(): number[][] {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  const grid: number[][] = [[], [], []]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      grid[row].push(REEL_STRIP[bytes[row * 3 + col] % REEL_STRIP.length])
    }
  }
  return grid
}

// ---- Evaluate with Wild Multiplier ----
export interface SlotWin {
  lineIndex: number
  symbolId: number
  payout: number
  wildMultiplier: number
}

export function evaluateSpin(
  grid: number[][],
  totalBet: number
): { wins: SlotWin[]; totalPayout: number } {
  const betPerLine = totalBet / 5
  const wins: SlotWin[] = []
  let totalPayout = 0

  for (let i = 0; i < PAYLINES.length; i++) {
    const line = PAYLINES[i]
    const s0 = grid[line[0][0]][line[0][1]]
    const s1 = grid[line[1][0]][line[1][1]]
    const s2 = grid[line[2][0]][line[2][1]]

    const matched = resolvePayline(s0, s1, s2)
    if (matched !== null) {
      const sym = SLOT_SYMBOLS.find((s) => s.id === matched)!
      // Wild multiplier: 2x if any position has wild and it's not all-wilds
      const hasWild = [s0, s1, s2].some((s) => s === WILD_SYMBOL)
      const wildMult = hasWild && matched !== WILD_SYMBOL ? 2 : 1
      const payout = Math.floor(betPerLine * sym.payout * wildMult)
      wins.push({ lineIndex: i, symbolId: matched, payout, wildMultiplier: wildMult })
      totalPayout += payout
    }
  }

  return { wins, totalPayout }
}

// ---- Scatter Pays ----
// Diamond (8) anywhere on grid: 2+ pays bonus regardless of paylines
export function evaluateScatter(
  grid: number[][],
  totalBet: number
): { count: number; payout: number } | null {
  let count = 0
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === SCATTER_SYMBOL) count++
    }
  }
  if (count < 2) return null
  const mults: Record<number, number> = { 2: 1, 3: 2, 4: 5, 5: 8 }
  const mult = mults[Math.min(count, 5)] || 1
  return { count, payout: Math.floor(totalBet * mult) }
}

// ---- Cascading Wins ----
// Winning symbols removed, new ones drop in, can chain wins
export interface CascadeStep {
  grid: number[][]
  wins: SlotWin[]
  payout: number
  multiplier: number
}

export const CASCADE_MULTIPLIERS = [1.25, 1.5, 2, 3]

export function cascadeWins(
  grid: number[][],
  initialWins: SlotWin[],
  totalBet: number
): { steps: CascadeStep[]; totalCascadePayout: number } {
  if (initialWins.length === 0) return { steps: [], totalCascadePayout: 0 }

  const steps: CascadeStep[] = []
  let totalCascadePayout = 0
  let currentGrid = grid.map((r) => [...r])
  let currentWins = initialWins
  let level = 0

  while (currentWins.length > 0 && level < 10) {
    // Find cells to remove from current wins
    const removedSet = new Set<string>()
    for (const win of currentWins) {
      for (const [r, c] of PAYLINES[win.lineIndex]) {
        removedSet.add(`${r},${c}`)
      }
    }

    // Drop new symbols into removed positions
    const newGrid = currentGrid.map((r) => [...r])
    for (let col = 0; col < 3; col++) {
      const remaining: number[] = []
      for (let row = 0; row < 3; row++) {
        if (!removedSet.has(`${row},${col}`)) remaining.push(currentGrid[row][col])
      }
      const needed = 3 - remaining.length
      if (needed === 0) continue
      const bytes = new Uint8Array(needed)
      crypto.getRandomValues(bytes)
      const newSyms = Array.from(bytes).map((b) => REEL_STRIP[b % REEL_STRIP.length])
      const fullCol = [...newSyms, ...remaining]
      for (let row = 0; row < 3; row++) newGrid[row][col] = fullCol[row]
    }

    currentGrid = newGrid
    const { wins: newWins, totalPayout } = evaluateSpin(currentGrid, totalBet)
    if (newWins.length === 0) break

    const mult = CASCADE_MULTIPLIERS[Math.min(level, CASCADE_MULTIPLIERS.length - 1)]
    const adjustedPayout = Math.floor(totalPayout * mult)

    steps.push({
      grid: currentGrid.map((r) => [...r]),
      wins: newWins,
      payout: adjustedPayout,
      multiplier: mult,
    })

    totalCascadePayout += adjustedPayout
    currentWins = newWins
    level++
  }

  return { steps, totalCascadePayout }
}

// ---- Nudge ----
export interface NudgeResult {
  row: number
  col: number
  newSymbol: number
}

function pairMatch(a: number, b: number): number | null {
  if (a === b) return a
  if (a === WILD_SYMBOL) return b
  if (b === WILD_SYMBOL) return a
  return null
}

export function checkNudge(grid: number[][], existingWins: SlotWin[]): NudgeResult | null {
  const byte = new Uint8Array(1)
  crypto.getRandomValues(byte)
  if (byte[0] / 255 > 0.20) return null

  const wonLines = new Set(existingWins.map((w) => w.lineIndex))

  for (let li = 0; li < PAYLINES.length; li++) {
    if (wonLines.has(li)) continue
    const line = PAYLINES[li]
    const syms = line.map(([r, c]) => grid[r][c])

    for (let skip = 0; skip < 3; skip++) {
      const i1 = (skip + 1) % 3
      const i2 = (skip + 2) % 3
      const target = pairMatch(syms[i1], syms[i2])
      if (target !== null && syms[skip] !== target && syms[skip] !== WILD_SYMBOL) {
        return { row: line[skip][0], col: line[skip][1], newSymbol: target }
      }
    }
  }

  return null
}

// ---- Progressive Jackpot (symbol-based triggers) ----
export const PROGRESSIVE_CONTRIBUTION = { mini: 0.025, major: 0.015, mega: 0.01 }
export const PROGRESSIVE_SEEDS = { mini: 100, major: 1000, mega: 10000 }

// MINI: 3+ Diamonds anywhere, MAJOR: Triple Jackpot (9) any payline, MEGA: Triple 9s on middle row
export function checkProgressiveTrigger(
  grid: number[][],
  wins: SlotWin[]
): 'mini' | 'major' | 'mega' | null {
  // MEGA: Triple Jackpot (9) on middle row
  if (grid[1][0] === 9 && grid[1][1] === 9 && grid[1][2] === 9) return 'mega'
  // MAJOR: Triple Jackpot (9) on any payline
  if (wins.some((w) => w.symbolId === 9)) return 'major'
  // MINI: 3+ Diamonds (8) anywhere on grid
  let dc = 0
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (grid[r][c] === SCATTER_SYMBOL) dc++
  if (dc >= 3) return 'mini'
  return null
}

// ---- Bonus ----
export const BONUS_FREE_SPINS = 10

export function hasBonus(wins: SlotWin[]): boolean {
  return wins.some((w) => w.symbolId === WILD_SYMBOL)
}

export function runBonusSpins(bet: number): {
  grids: number[][][]
  payouts: number[]
  totalBonusPayout: number
} {
  const grids: number[][][] = []
  const payouts: number[] = []
  let totalBonusPayout = 0
  for (let i = 0; i < BONUS_FREE_SPINS; i++) {
    const grid = spinReels()
    expandWilds(grid)
    const { totalPayout } = evaluateSpin(grid, bet)
    grids.push(grid)
    payouts.push(totalPayout)
    totalBonusPayout += totalPayout
  }
  return { grids, payouts, totalBonusPayout }
}

// ---- Hold & Respin ----
// After a near-miss (no wins but 2 matching on a payline), offer to hold columns and respin
export function checkHoldOpportunity(grid: number[][], wins: SlotWin[]): number[] | null {
  if (wins.length > 0) return null

  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li]
    const syms = line.map(([r, c]) => grid[r][c])
    for (let skip = 0; skip < 3; skip++) {
      const i1 = (skip + 1) % 3
      const i2 = (skip + 2) % 3
      const target = pairMatch(syms[i1], syms[i2])
      if (target !== null && syms[skip] !== target && syms[skip] !== WILD_SYMBOL) {
        return [...new Set([line[i1][1], line[i2][1]])]
      }
    }
  }
  return null
}

export function holdRespin(grid: number[][], holdCols: number[]): number[][] {
  const newGrid = grid.map((r) => [...r])
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  for (let col = 0; col < 3; col++) {
    if (holdCols.includes(col)) continue
    for (let row = 0; row < 3; row++) {
      newGrid[row][col] = REEL_STRIP[bytes[row * 3 + col] % REEL_STRIP.length]
    }
  }
  return newGrid
}

// ---- Gamble (double-or-nothing) ----
export function resolveGamble(): boolean {
  const byte = new Uint8Array(1)
  crypto.getRandomValues(byte)
  return byte[0] < 128 // 50/50
}

// ---- Streak Multiplier ----
// 3+ consecutive winning spins = escalating multiplier
export function getStreakMultiplier(streak: number): number {
  if (streak >= 5) return 2
  if (streak >= 4) return 1.5
  if (streak >= 3) return 1.2
  return 1
}
