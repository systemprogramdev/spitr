// XP amounts per action
export const XP_AMOUNTS: Record<string, number> = {
  post: 10,
  reply: 5,
  respit: 3,
  like: 2,
  attack: 8,
  transfer: 3,
  chest_open: 15,
  potion_use: 2,
  bank_deposit: 5,
  bank_withdraw: 3,
  stock_buy: 8,
  stock_sell: 8,
  ticket_buy: 5,
  ticket_scratch: 3,
  cd_buy: 5,
  cd_redeem: 8,
}

// XP needed to reach a given level (cumulative)
// Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 300 XP, etc.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(100 * level * (level - 1) / 2)
}

// Calculate level from total XP
// Inverse of xpForLevel: floor((1 + sqrt(1 + xp/12.5)) / 2)
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2))
}

// XP remaining until next level
export function xpToNextLevel(xp: number, level: number): number {
  const nextLevelXp = xpForLevel(level + 1)
  return Math.max(0, nextLevelXp - xp)
}

// Progress percentage within current level (0-100)
export function xpProgress(xp: number, level: number): number {
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const range = nextLevelXp - currentLevelXp
  if (range <= 0) return 100
  return Math.min(100, Math.max(0, ((xp - currentLevelXp) / range) * 100))
}

// Level badge color tier
export function levelColor(level: number): string {
  if (level >= 51) return '#fbbf24' // gold
  if (level >= 21) return '#a855f7' // purple
  if (level >= 11) return '#3b82f6' // blue
  if (level >= 6) return '#22c55e'  // green
  return '#9ca3af'                  // gray
}
