import { ItemType } from '@/types'

export interface GameItem {
  type: ItemType
  name: string
  description: string
  category: 'weapon' | 'potion' | 'defense' | 'powerup' | 'utility'
  goldCost: number
  damage?: number
  healAmount?: number
  effect?: string
  emoji: string
}

export const ITEMS: GameItem[] = [
  // Weapons
  { type: 'knife', name: 'Knife', description: 'A basic blade. Quick and cheap.', category: 'weapon', goldCost: 1, damage: 5, emoji: '🔪' },
  { type: 'gun', name: 'Gun', description: 'Reliable firepower.', category: 'weapon', goldCost: 5, damage: 25, emoji: '🔫' },
  { type: 'soldier', name: 'Soldier', description: 'Sends in a mercenary.', category: 'weapon', goldCost: 25, damage: 100, emoji: '💂' },
  { type: 'drone', name: 'Drone', description: 'Devastating aerial strike.', category: 'weapon', goldCost: 100, damage: 500, emoji: '🛩️' },
  { type: 'nuke', name: 'Nuke', description: 'Devastating nuclear strike.', category: 'weapon', goldCost: 250, damage: 2500, emoji: '☢️' },
  { type: 'emp', name: 'EMP', description: '200 DMG + strips all defense buffs.', category: 'weapon', goldCost: 50, damage: 200, emoji: '⚡' },
  { type: 'malware', name: 'Malware', description: '75 DMG + steals a random item.', category: 'weapon', goldCost: 15, damage: 75, emoji: '🦠' },
  // Potions
  { type: 'small_potion', name: 'Small Potion', description: 'Restores 500 HP.', category: 'potion', goldCost: 10, healAmount: 500, emoji: '🧪' },
  { type: 'medium_potion', name: 'Medium Potion', description: 'Restores 1500 HP.', category: 'potion', goldCost: 25, healAmount: 1500, emoji: '⚗️' },
  { type: 'large_potion', name: 'Large Potion', description: 'Full restore (5000 HP).', category: 'potion', goldCost: 75, healAmount: 5000, emoji: '🏺' },
  { type: 'soda', name: 'Can of Soda', description: 'A quick refreshment. +50 HP.', category: 'potion', goldCost: 1, healAmount: 50, emoji: '🥤' },
  // Defense
  { type: 'firewall', name: 'Firewall', description: 'Blocks the next attack completely.', category: 'defense', goldCost: 15, emoji: '🛡️' },
  { type: 'kevlar', name: 'Kevlar Vest', description: 'Blocks next 3 attacks (not drones/nukes).', category: 'defense', goldCost: 30, emoji: '🦺' },
  { type: 'mirror_shield', name: 'Mirror Shield', description: 'Reflects 100% of next attack back.', category: 'defense', goldCost: 40, emoji: '🪞' },
  // Power-ups
  { type: 'rage_serum', name: 'Rage Serum', description: '2x damage on next 3 attacks.', category: 'powerup', goldCost: 25, effect: '2x DMG (3 attacks)', emoji: '🔴' },
  { type: 'critical_chip', name: 'Critical Chip', description: '30% chance for 3x damage, 5 attacks.', category: 'powerup', goldCost: 15, effect: '30% crit (5 attacks)', emoji: '💎' },
  { type: 'xp_boost', name: 'XP Boost', description: '2x XP for 1 hour.', category: 'powerup', goldCost: 10, effect: '2x XP (1 hour)', emoji: '📈' },
  // Utility
  { type: 'spray_paint', name: 'Spray Paint', description: 'Tag someone\'s profile for 24h.', category: 'utility', goldCost: 5, emoji: '🎨' },
  { type: 'fake_death', name: 'Fake Death', description: 'Profile shows 0 HP to others for 12h.', category: 'utility', goldCost: 15, effect: '0 HP disguise (12h)', emoji: '💀' },
  { type: 'name_tag', name: 'Name Tag', description: 'Give someone a custom title for 24h.', category: 'utility', goldCost: 5, effect: 'Custom title (24h)', emoji: '🏷️' },
  { type: 'smoke_bomb', name: 'Smoke Bomb', description: 'Clears all spray paints from your profile.', category: 'utility', goldCost: 8, effect: 'Remove all tags', emoji: '💨' },
]

export const ITEM_MAP = new Map(ITEMS.map(item => [item.type, item]))

export const WEAPONS = ITEMS.filter(i => i.category === 'weapon')
export const POTIONS = ITEMS.filter(i => i.category === 'potion')
export const DEFENSE_ITEMS = ITEMS.filter(i => i.category === 'defense')
export const POWERUP_ITEMS = ITEMS.filter(i => i.category === 'powerup')
export const UTILITY_ITEMS = ITEMS.filter(i => i.category === 'utility')

export const GOLD_PACKAGES = [
  { id: 'gold_100', gold: 100, price: 199, name: '100 Gold', description: 'A handful of gold' },
  { id: 'gold_500', gold: 500, price: 799, name: '500 Gold', description: 'A pouch of gold' },
  { id: 'gold_1500', gold: 1500, price: 1999, name: '1,500 Gold', description: 'A chest of gold', popular: true },
  { id: 'gold_5000', gold: 5000, price: 4999, name: '5,000 Gold', description: 'A vault of gold', whale: true },
]

export const SPIT_TO_GOLD_RATIO = 10 // 10 spit = 1 gold
export const BASE_HP = 5000
export const HP_PER_LEVEL = 100
export const MAX_HP = 5000 // legacy default, use getMaxHp(level) for dynamic
export function getMaxHp(level: number): number {
  return BASE_HP + (level - 1) * HP_PER_LEVEL
}
export const SPIT_MAX_HP = 10

// Treasure Chest Loot System
export interface LootReward {
  type: 'credits' | 'gold' | 'item'
  amount: number
  itemType?: ItemType
  rarity: 'common' | 'uncommon' | 'rare' | 'epic'
  label: string
  emoji: string
}

interface LootPool {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic'
  weight: number
  rewards: Array<() => LootReward>
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export const CHEST_LOOT_POOLS: LootPool[] = [
  {
    rarity: 'common',
    weight: 70,
    rewards: [
      () => { const n = randInt(5, 15); return { type: 'credits', amount: n, rarity: 'common', label: `${n} Spits`, emoji: '⭐' } },
      () => { const n = randInt(1, 3); return { type: 'gold', amount: n, rarity: 'common', label: `${n} Gold`, emoji: '🪙' } },
      () => ({ type: 'item', amount: 1, itemType: 'knife' as ItemType, rarity: 'common', label: '1 Knife', emoji: '🔪' }),
      () => ({ type: 'item', amount: 1, itemType: 'soda' as ItemType, rarity: 'common', label: '1 Soda', emoji: '🥤' }),
      () => ({ type: 'item', amount: 1, itemType: 'smoke_bomb' as ItemType, rarity: 'common', label: '1 Smoke Bomb', emoji: '💨' }),
    ],
  },
  {
    rarity: 'uncommon',
    weight: 22,
    rewards: [
      () => { const n = randInt(20, 50); return { type: 'credits', amount: n, rarity: 'uncommon', label: `${n} Spits`, emoji: '⭐' } },
      () => { const n = randInt(3, 8); return { type: 'gold', amount: n, rarity: 'uncommon', label: `${n} Gold`, emoji: '🪙' } },
      () => ({ type: 'item', amount: 1, itemType: 'small_potion' as ItemType, rarity: 'uncommon', label: '1 Small Potion', emoji: '🧪' }),
      () => ({ type: 'item', amount: 1, itemType: 'malware' as ItemType, rarity: 'uncommon', label: '1 Malware', emoji: '🦠' }),
      () => ({ type: 'item', amount: 1, itemType: 'name_tag' as ItemType, rarity: 'uncommon', label: '1 Name Tag', emoji: '🏷️' }),
      () => ({ type: 'item', amount: 1, itemType: 'critical_chip' as ItemType, rarity: 'uncommon', label: '1 Critical Chip', emoji: '💎' }),
    ],
  },
  {
    rarity: 'rare',
    weight: 7,
    rewards: [
      () => { const n = randInt(50, 100); return { type: 'credits', amount: n, rarity: 'rare', label: `${n} Spits`, emoji: '⭐' } },
      () => { const n = randInt(8, 15); return { type: 'gold', amount: n, rarity: 'rare', label: `${n} Gold`, emoji: '🪙' } },
      () => ({ type: 'item', amount: 1, itemType: 'gun' as ItemType, rarity: 'rare', label: '1 Gun', emoji: '🔫' }),
      () => ({ type: 'item', amount: 1, itemType: 'medium_potion' as ItemType, rarity: 'rare', label: '1 Medium Potion', emoji: '⚗️' }),
      () => ({ type: 'item', amount: 1, itemType: 'firewall' as ItemType, rarity: 'rare', label: '1 Firewall', emoji: '🛡️' }),
      () => ({ type: 'item', amount: 1, itemType: 'rage_serum' as ItemType, rarity: 'rare', label: '1 Rage Serum', emoji: '🔴' }),
      () => ({ type: 'item', amount: 1, itemType: 'xp_boost' as ItemType, rarity: 'rare', label: '1 XP Boost', emoji: '📈' }),
      () => ({ type: 'item', amount: 1, itemType: 'fake_death' as ItemType, rarity: 'rare', label: '1 Fake Death', emoji: '💀' }),
    ],
  },
  {
    rarity: 'epic',
    weight: 1,
    rewards: [
      () => { const n = randInt(100, 200); return { type: 'credits', amount: n, rarity: 'epic', label: `${n} Spits`, emoji: '⭐' } },
      () => { const n = randInt(15, 30); return { type: 'gold', amount: n, rarity: 'epic', label: `${n} Gold`, emoji: '🪙' } },
      () => ({ type: 'item', amount: 1, itemType: 'soldier' as ItemType, rarity: 'epic', label: '1 Soldier', emoji: '💂' }),
      () => ({ type: 'item', amount: 1, itemType: 'drone' as ItemType, rarity: 'epic', label: '1 Drone', emoji: '🛩️' }),
      () => ({ type: 'item', amount: 1, itemType: 'large_potion' as ItemType, rarity: 'epic', label: '1 Large Potion', emoji: '🏺' }),
      () => ({ type: 'item', amount: 1, itemType: 'emp' as ItemType, rarity: 'epic', label: '1 EMP', emoji: '⚡' }),
      () => ({ type: 'item', amount: 1, itemType: 'mirror_shield' as ItemType, rarity: 'epic', label: '1 Mirror Shield', emoji: '🪞' }),
    ],
  },
]

export const RARITY_COLORS: Record<string, string> = {
  common: '#ffffff',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
}

export function rollChestLoot(): LootReward[] {
  const totalWeight = CHEST_LOOT_POOLS.reduce((s, p) => s + p.weight, 0)
  const numRewards = randInt(2, 3)
  const results: LootReward[] = []

  for (let i = 0; i < numRewards; i++) {
    let roll = Math.random() * totalWeight
    let selectedPool = CHEST_LOOT_POOLS[0]
    for (const pool of CHEST_LOOT_POOLS) {
      roll -= pool.weight
      if (roll <= 0) {
        selectedPool = pool
        break
      }
    }
    const rewardFn = selectedPool.rewards[Math.floor(Math.random() * selectedPool.rewards.length)]
    results.push(rewardFn())
  }

  return results
}
