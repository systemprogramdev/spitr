// ============================================
// SPITr Credit Card System
// ============================================

export interface ScoreTier {
  min: number
  name: string
  color: string
  limitCap: number
}

export const CREDIT_SCORE_TIERS: ScoreTier[] = [
  { min: 800, name: 'LEGENDARY', color: '#a855f7', limitCap: 50000 },
  { min: 700, name: 'ELITE', color: '#3b82f6', limitCap: 25000 },
  { min: 600, name: 'TRUSTED', color: '#22c55e', limitCap: 10000 },
  { min: 500, name: 'SECURE', color: '#eab308', limitCap: 5000 },
  { min: 300, name: 'BASIC', color: '#f59e0b', limitCap: 2000 },
  { min: 100, name: 'COMPROMISED', color: '#ef4444', limitCap: 500 },
]

export function getScoreTier(score: number): ScoreTier {
  return CREDIT_SCORE_TIERS.find(t => score >= t.min) || CREDIT_SCORE_TIERS[CREDIT_SCORE_TIERS.length - 1]
}

export function getScorePercent(score: number): number {
  return Math.max(0, Math.min(100, ((score - 100) / (850 - 100)) * 100))
}

export function getAvailableCredit(limit: number, balance: number): number {
  return Math.max(0, limit - balance)
}

export function getUtilizationPercent(limit: number, balance: number): number {
  if (limit <= 0) return 0
  return Math.min(100, (balance / limit) * 100)
}

export function getBillingCycleDaysRemaining(cycleStart: string): number {
  const startMs = new Date(cycleStart).getTime()
  const nowMs = Date.now()
  const elapsed = (nowMs - startMs) / (86400 * 1000)
  return Math.max(0, 7 - elapsed)
}

export function canRequestIncrease(lastIncreaseAt: string | null): boolean {
  if (!lastIncreaseAt) return true
  const elapsed = Date.now() - new Date(lastIncreaseAt).getTime()
  return elapsed >= 7 * 24 * 60 * 60 * 1000
}

export function daysUntilIncrease(lastIncreaseAt: string | null): number {
  if (!lastIncreaseAt) return 0
  const elapsed = (Date.now() - new Date(lastIncreaseAt).getTime()) / (86400 * 1000)
  return Math.max(0, 7 - elapsed)
}

// Transaction type labels for UI
export const CC_TXN_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  cash_advance: 'Cash Advance',
  payment: 'Payment',
  interest: 'Interest',
  late_fee: 'Late Fee',
  reward: 'Reward',
}
