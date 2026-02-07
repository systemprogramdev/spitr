import { BankDeposit } from '@/types'

// ============================================
// Interest Rate System
// ============================================

// Rate oscillates between 0.5% and 1% daily with a ~12 hour period
const MIN_RATE = 0.005
const MAX_RATE = 0.01
const RATE_PERIOD_MS = 12 * 60 * 60 * 1000 // 12 hours

export function getCurrentDailyRate(now: Date = new Date()): number {
  const t = now.getTime() / RATE_PERIOD_MS
  const wave = (Math.sin(t * 2 * Math.PI) + 1) / 2 // 0 to 1
  return MIN_RATE + wave * (MAX_RATE - MIN_RATE)
}

export function formatRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%'
}

// ============================================
// Interest Calculation
// ============================================

export function calculateInterest(
  principal: number,
  rate: number,
  depositedAt: string | Date,
  now: Date = new Date()
): number {
  const depositTime = new Date(depositedAt).getTime()
  const nowTime = now.getTime()
  const daysElapsed = (nowTime - depositTime) / (86400 * 1000)
  if (daysElapsed <= 0) return 0
  const interest = principal * rate * daysElapsed
  // Floor to 5 decimal places
  return Math.floor(interest * 100000) / 100000
}

export interface BankBalance {
  totalPrincipal: number
  totalInterest: number
  totalBalance: number
  totalWithdrawn: number
}

export function calculateBankBalance(
  deposits: BankDeposit[],
  now: Date = new Date()
): BankBalance {
  let totalPrincipal = 0
  let totalInterest = 0
  let totalWithdrawn = 0

  for (const d of deposits) {
    const interest = calculateInterest(d.principal, d.locked_rate, d.deposited_at, now)
    totalPrincipal += d.principal
    totalInterest += interest
    totalWithdrawn += d.withdrawn
  }

  return {
    totalPrincipal,
    totalInterest,
    totalBalance: totalPrincipal + totalInterest - totalWithdrawn,
    totalWithdrawn,
  }
}

// ============================================
// Stock Market
// ============================================

// Fixed launch date for deterministic pricing
export const BANK_LAUNCH_DATE = new Date('2026-02-07T00:00:00Z')

export function getStockPrice(now: Date = new Date()): number {
  const msElapsed = now.getTime() - BANK_LAUNCH_DATE.getTime()
  const daysElapsed = msElapsed / (86400 * 1000)
  const t = Math.max(0, daysElapsed)

  // Base trend: starts at 3, grows ~17 per year
  const base = 3 + 17 * (t / 365)

  // Oscillations for volatility
  const osc1 = 2 * Math.sin(t * 2 * Math.PI / 7)       // weekly cycle
  const osc2 = 1.5 * Math.sin(t * 2 * Math.PI / 3.1)   // ~3 day cycle
  const osc3 = 0.8 * Math.sin(t * 2 * Math.PI / 0.5)   // 12h cycle

  // Deterministic pseudo-noise based on day
  const dayInt = Math.floor(t)
  const noise = Math.sin(dayInt * 12345.6789) * 1.5

  const price = base + osc1 + osc2 + osc3 + noise
  return Math.max(0.1, Math.round(price * 100) / 100)
}

export interface StockDataPoint {
  time: number // timestamp
  price: number
}

export function getStockPriceHistory(
  days: number = 30,
  pointsPerDay: number = 4,
  now: Date = new Date()
): StockDataPoint[] {
  const points: StockDataPoint[] = []
  const totalPoints = days * pointsPerDay
  const msPerPoint = (days * 86400 * 1000) / totalPoints
  const startMs = now.getTime() - days * 86400 * 1000

  for (let i = 0; i <= totalPoints; i++) {
    const t = startMs + i * msPerPoint
    const price = getStockPrice(new Date(t))
    points.push({ time: t, price })
  }

  return points
}

// ============================================
// Lottery System
// ============================================

export interface TicketTier {
  type: string
  name: string
  cost: number
  currency: 'spit' | 'gold'
  emoji: string
}

export const TICKET_TIERS: TicketTier[] = [
  { type: 'ping', name: 'Ping Scratch', cost: 1, currency: 'spit', emoji: '📡' },
  { type: 'phishing', name: 'Phishing Scratch', cost: 10, currency: 'spit', emoji: '🎣' },
  { type: 'buffer', name: 'Buffer Overflow', cost: 50, currency: 'spit', emoji: '💾' },
  { type: 'ddos', name: 'DDoS Deluxe', cost: 100, currency: 'spit', emoji: '🌊' },
  { type: 'token', name: 'Token Flip', cost: 1, currency: 'gold', emoji: '🪙' },
  { type: 'backdoor', name: 'Backdoor Access', cost: 5, currency: 'gold', emoji: '🔓' },
  { type: 'zeroday', name: 'Zero Day Exploit', cost: 25, currency: 'gold', emoji: '🐛' },
  { type: 'mainframe', name: 'Mainframe Jackpot', cost: 100, currency: 'gold', emoji: '🏛️' },
]

export const TICKET_MAP = new Map(TICKET_TIERS.map(t => [t.type, t]))

export interface TicketOutcome {
  isWinner: boolean
  prizeAmount: number
}

// Server-side: Roll ticket outcome
// 80% lose, 20% win with prize tiers
// Prize distribution: 60% small (1-2x), 25% medium (2-5x), 10% large (5-10x), 4% big (10-25x), 1% jackpot (50-100x)
export function rollTicketOutcome(ticketType: string): TicketOutcome {
  const tier = TICKET_MAP.get(ticketType)
  if (!tier) return { isWinner: false, prizeAmount: 0 }

  const roll = Math.random()

  // 80% chance to lose
  if (roll >= 0.20) {
    return { isWinner: false, prizeAmount: 0 }
  }

  // Winner! Determine prize tier
  const prizeRoll = Math.random()
  let multiplier: number

  if (prizeRoll < 0.60) {
    // Small: 1-2x
    multiplier = 1 + Math.random()
  } else if (prizeRoll < 0.85) {
    // Medium: 2-5x
    multiplier = 2 + Math.random() * 3
  } else if (prizeRoll < 0.95) {
    // Large: 5-10x
    multiplier = 5 + Math.random() * 5
  } else if (prizeRoll < 0.99) {
    // Big: 10-25x
    multiplier = 10 + Math.random() * 15
  } else {
    // Jackpot: 50-100x
    multiplier = 50 + Math.random() * 50
  }

  const prizeAmount = Math.floor(tier.cost * multiplier * 100000) / 100000

  return { isWinner: true, prizeAmount }
}
