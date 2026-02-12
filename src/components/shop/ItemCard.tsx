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
    <div className="shop-item-card">
      <div className="shop-item-emoji">{item.emoji}</div>
      <div className="shop-item-info">
        <div className="shop-item-name">{item.name}</div>
        {item.damage && (
          <div className="shop-item-stat shop-item-stat-damage">{item.damage} DMG</div>
        )}
        {item.healAmount && (
          <div className="shop-item-stat shop-item-stat-heal">+{item.healAmount} HP</div>
        )}
        {item.effect && (
          <div className="shop-item-stat" style={{ color: 'var(--sys-primary)' }}>{item.effect}</div>
        )}
        {item.category === 'defense' && !item.effect && (
          <div className="shop-item-stat" style={{ color: 'var(--sys-primary)' }}>Blocks attacks</div>
        )}
      </div>
      <div className="shop-item-actions">
        <div className="shop-item-cost">{item.goldCost}g</div>
        {quantity > 0 && (
          <div className="shop-item-qty">x{quantity}</div>
        )}
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
            {item.category === 'defense' ? 'Activate' : 'Use'}
          </button>
        )}
      </div>
    </div>
  )
}
