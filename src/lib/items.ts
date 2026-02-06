import { ItemType } from '@/types'

export interface GameItem {
  type: ItemType
  name: string
  description: string
  category: 'weapon' | 'potion'
  goldCost: number
  damage?: number
  healAmount?: number
  emoji: string
}

export const ITEMS: GameItem[] = [
  // Weapons
  { type: 'knife', name: 'Knife', description: 'A basic blade. Quick and cheap.', category: 'weapon', goldCost: 1, damage: 5, emoji: '🔪' },
  { type: 'gun', name: 'Gun', description: 'Reliable firepower.', category: 'weapon', goldCost: 5, damage: 25, emoji: '🔫' },
  { type: 'soldier', name: 'Soldier', description: 'Sends in a mercenary.', category: 'weapon', goldCost: 25, damage: 100, emoji: '💂' },
  { type: 'drone', name: 'Drone', description: 'Devastating aerial strike.', category: 'weapon', goldCost: 100, damage: 500, emoji: '🛩️' },
  // Potions
  { type: 'small_potion', name: 'Small Potion', description: 'Restores 500 HP.', category: 'potion', goldCost: 10, healAmount: 500, emoji: '🧪' },
  { type: 'medium_potion', name: 'Medium Potion', description: 'Restores 1500 HP.', category: 'potion', goldCost: 25, healAmount: 1500, emoji: '⚗️' },
  { type: 'large_potion', name: 'Large Potion', description: 'Full restore (5000 HP).', category: 'potion', goldCost: 75, healAmount: 5000, emoji: '🏺' },
]

export const ITEM_MAP = new Map(ITEMS.map(item => [item.type, item]))

export const WEAPONS = ITEMS.filter(i => i.category === 'weapon')
export const POTIONS = ITEMS.filter(i => i.category === 'potion')

export const GOLD_PACKAGES = [
  { id: 'gold_10', gold: 10, price: 199, name: '10 Gold', description: 'A handful of gold' },
  { id: 'gold_50', gold: 50, price: 799, name: '50 Gold', description: 'A pouch of gold' },
  { id: 'gold_150', gold: 150, price: 1999, name: '150 Gold', description: 'A chest of gold', popular: true },
  { id: 'gold_500', gold: 500, price: 4999, name: '500 Gold', description: 'A vault of gold', whale: true },
]

export const SPIT_TO_GOLD_RATIO = 10 // 10 spit = 1 gold
export const MAX_HP = 5000
export const SPIT_MAX_HP = 10
