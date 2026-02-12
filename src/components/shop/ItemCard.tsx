'use client'

import { GameItem } from '@/lib/items'

interface ItemCardProps {
  item: GameItem
  quantity?: number
  goldBalance: number
  onBuy: (item: GameItem) => void
  onUse?: (item: GameItem) => void
  buying?: boolean
}

export function ItemCard({ item, quantity = 0, goldBalance, onBuy, onUse, buying }: ItemCardProps) {
  const canAfford = goldBalance >= item.goldCost
  const canUse = item.category === 'potion' || item.category === 'defense' || item.category === 'powerup' ||
    (item.category === 'utility' && ['smoke_bomb', 'fake_death', 'name_tag'].includes(item.type))

  return (
    <div className="shop-item-row">
      <div className="shop-item-icon">{item.emoji}</div>
      <div className="shop-item-info">
        <div className="shop-item-name">
          {item.name}
          {quantity > 0 && <span className="shop-item-qty">x{quantity}</span>}
        </div>
        <div className="shop-item-meta">
          {item.damage && <span className="shop-item-stat-damage">{item.damage} DMG</span>}
          {item.healAmount && <span className="shop-item-stat-heal">+{item.healAmount} HP</span>}
          {item.effect && <span className="shop-item-stat-effect">{item.effect}</span>}
          {item.category === 'defense' && !item.effect && <span className="shop-item-stat-effect">Blocks attacks</span>}
          {item.type === 'emp' && <span className="shop-item-stat-special">+ strip buffs</span>}
          {item.type === 'malware' && <span className="shop-item-stat-special">+ steal item</span>}
        </div>
      </div>
      <div className="shop-item-right">
        <span className="shop-item-cost">{item.goldCost}g</span>
        <button
          className="btn btn-warning shop-item-buy"
          onClick={() => onBuy(item)}
          disabled={!canAfford || buying}
        >
          {buying ? '...' : 'Buy'}
        </button>
        {onUse && quantity > 0 && canUse && (
          <button
            className="btn btn-primary shop-item-use"
            onClick={() => onUse(item)}
          >
            {item.category === 'defense' ? 'Equip' : 'Use'}
          </button>
        )}
      </div>
    </div>
  )
}
