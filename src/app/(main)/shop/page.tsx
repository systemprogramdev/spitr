'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useGold } from '@/hooks/useGold'
import { useInventory } from '@/hooks/useInventory'
import { useCredits } from '@/hooks/useCredits'
import { useModalStore } from '@/stores/modalStore'
import { ITEMS, WEAPONS, POTIONS, GOLD_PACKAGES, SPIT_TO_GOLD_RATIO, ITEM_MAP, MAX_HP } from '@/lib/items'
import { ItemCard } from '@/components/shop/ItemCard'
import { GoldCheckoutModal } from '@/components/shop/GoldCheckoutModal'
import { HPBar } from '@/components/ui/HPBar'
import { GameItem } from '@/lib/items'
import { UserChest } from '@/types'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function ShopPage() {
  const { user } = useAuthStore()
  const { balance: goldBalance, addGold, deductGold, hasGold, refreshBalance: refreshGold } = useGold()
  const { balance: creditBalance, deductAmount, refreshBalance: refreshCredits } = useCredits()
  const { items, refreshInventory, getQuantity } = useInventory()

  const { openChestOpenModal } = useModalStore()
  const [convertAmount, setConvertAmount] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [buyingItem, setBuyingItem] = useState<string | null>(null)
  const [usingPotion, setUsingPotion] = useState<string | null>(null)
  const [checkoutPkg, setCheckoutPkg] = useState<typeof GOLD_PACKAGES[number] | null>(null)
  const [userHp, setUserHp] = useState(user?.hp ?? MAX_HP)
  const [unopenedChests, setUnopenedChests] = useState<UserChest[]>([])

  const fetchChests = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_chests')
      .select('*')
      .eq('user_id', user.id)
      .eq('opened', false)
      .order('claimed_at', { ascending: false })
    if (data) setUnopenedChests(data)
  }, [user])

  useEffect(() => {
    fetchChests()
  }, [fetchChests])

  // Listen for chest events to refresh
  useEffect(() => {
    const handleChestEvent = () => { fetchChests() }
    window.addEventListener('chest-claimed', handleChestEvent)
    window.addEventListener('chest-opened', handleChestEvent)
    return () => {
      window.removeEventListener('chest-claimed', handleChestEvent)
      window.removeEventListener('chest-opened', handleChestEvent)
    }
  }, [fetchChests])

  // Refresh HP from user store
  const refreshHp = async () => {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('hp')
      .eq('id', user.id)
      .single()
    if (data) setUserHp(data.hp)
  }

  const handleConvert = async () => {
    if (!user || isConverting) return
    const spitsToConvert = parseInt(convertAmount, 10)
    if (isNaN(spitsToConvert) || spitsToConvert < SPIT_TO_GOLD_RATIO) return

    const goldToGet = Math.floor(spitsToConvert / SPIT_TO_GOLD_RATIO)
    const actualSpitCost = goldToGet * SPIT_TO_GOLD_RATIO

    setIsConverting(true)

    // Deduct spits
    const credited = await deductAmount(actualSpitCost, 'post', 'gold_convert')
    if (!credited) {
      alert('Insufficient spits!')
      setIsConverting(false)
      return
    }

    // Add gold
    const added = await addGold(goldToGet, 'convert')
    if (!added) {
      alert('Failed to add gold. Your spits were deducted — contact support.')
    }

    setConvertAmount('')
    setIsConverting(false)
  }

  const handleBuyItem = async (item: GameItem) => {
    if (!user || buyingItem) return
    if (!hasGold(item.goldCost)) {
      alert('Insufficient gold!')
      return
    }

    setBuyingItem(item.type)

    // Deduct gold
    const deducted = await deductGold(item.goldCost, 'item_purchase', item.type)
    if (!deducted) {
      alert('Failed to purchase item.')
      setBuyingItem(null)
      return
    }

    // Add to inventory — read current qty from DB to avoid stale state
    const { data: existing } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('item_type', item.type)
      .single()

    const currentQty = existing?.quantity ?? 0
    const { error } = await supabase
      .from('user_inventory')
      .upsert(
        {
          user_id: user.id,
          item_type: item.type,
          quantity: currentQty + 1,
        },
        { onConflict: 'user_id,item_type' }
      )

    if (error) {
      console.error('Inventory error:', error)
      alert('Failed to add item to inventory.')
    } else {
      await refreshInventory()
    }

    setBuyingItem(null)
  }

  const handleUsePotion = async (item: GameItem) => {
    if (!user || !item.healAmount || usingPotion) return

    setUsingPotion(item.type)

    const res = await fetch('/api/use-potion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType: item.type,
        healAmount: item.healAmount,
      }),
    })

    const data = await res.json()

    if (data.success) {
      setUserHp(data.newHp)
      await refreshInventory()
      alert(`Healed for ${data.healed} HP! New HP: ${data.newHp}`)
    } else {
      alert(data.error || 'Failed to use potion.')
    }

    setUsingPotion(null)
  }

  const handleGoldPurchaseSuccess = async (gold: number) => {
    await refreshGold()
    setCheckoutPkg(null)
    alert(`${gold} Gold added to your balance!`)
  }

  const goldFromSpits = convertAmount ? Math.floor(parseInt(convertAmount, 10) / SPIT_TO_GOLD_RATIO) || 0 : 0

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span style={{ marginRight: '0.5rem' }}>🏪</span>
          Shop
        </h1>
      </header>

      {/* Gold Balance + HP */}
      <div className="shop-balance-panel">
        <div className="shop-gold-display">
          <span className="shop-gold-icon">🪙</span>
          <span className="shop-gold-amount">{goldBalance.toLocaleString()}</span>
          <span className="shop-gold-label">Gold</span>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <HPBar hp={userHp} maxHp={MAX_HP} size="md" />
        </div>
      </div>

      {/* My Chests */}
      {unopenedChests.length > 0 && (
        <div className="shop-section">
          <h2 className="shop-section-title">
            <span>🎁</span> My Chests ({unopenedChests.length})
          </h2>
          <div className="shop-chests-grid">
            {unopenedChests.map((chest) => (
              <div key={chest.id} className="shop-chest-card">
                <span className="shop-chest-emoji">🎁</span>
                <span className="shop-chest-date">
                  {new Date(chest.claimed_at).toLocaleDateString()}
                </span>
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => openChestOpenModal(chest.id)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convert Spits → Gold */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🔄</span> Convert Spits → Gold
        </h2>
        <p className="shop-section-desc">{SPIT_TO_GOLD_RATIO} spits = 1 gold. You have {creditBalance.toLocaleString()} spits.</p>
        <div className="shop-convert-row">
          <input
            type="number"
            className="input"
            value={convertAmount}
            onChange={(e) => setConvertAmount(e.target.value)}
            placeholder={`Min ${SPIT_TO_GOLD_RATIO} spits`}
            min={SPIT_TO_GOLD_RATIO}
            style={{ flex: 1 }}
          />
          <span className="shop-convert-arrow">→</span>
          <span className="shop-convert-result">{goldFromSpits}g</span>
          <button
            className="btn btn-warning"
            onClick={handleConvert}
            disabled={isConverting || goldFromSpits < 1}
          >
            {isConverting ? '...' : 'Convert'}
          </button>
        </div>
      </div>

      {/* Buy Gold with Stripe */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>💳</span> Buy Gold
        </h2>
        <div className="shop-packages-grid">
          {GOLD_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              className={`shop-package ${pkg.popular ? 'shop-package-popular' : ''} ${pkg.whale ? 'shop-package-whale' : ''}`}
              onClick={() => setCheckoutPkg(pkg)}
            >
              {pkg.popular && <span className="shop-package-badge">POPULAR</span>}
              {pkg.whale && <span className="shop-package-badge shop-package-badge-whale">BEST VALUE</span>}
              <div className="shop-package-gold">{pkg.gold}g</div>
              <div className="shop-package-price">${(pkg.price / 100).toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Weapons */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>⚔️</span> Weapons
        </h2>
        <div className="shop-items-grid">
          {WEAPONS.map((item) => (
            <ItemCard
              key={item.type}
              item={item}
              quantity={getQuantity(item.type)}
              goldBalance={goldBalance}
              onBuy={handleBuyItem}
              buying={buyingItem === item.type}
            />
          ))}
        </div>
      </div>

      {/* Potions */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🧪</span> Potions
        </h2>
        <div className="shop-items-grid">
          {POTIONS.map((item) => (
            <ItemCard
              key={item.type}
              item={item}
              quantity={getQuantity(item.type)}
              goldBalance={goldBalance}
              onBuy={handleBuyItem}
              onUse={handleUsePotion}
              buying={buyingItem === item.type}
            />
          ))}
        </div>
      </div>

      {/* Inventory */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🎒</span> Inventory
        </h2>
        <div className="shop-inventory-grid">
          {items.filter(i => i.quantity > 0).length === 0 ? (
            <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center', padding: '1.5rem' }}>
              Your inventory is empty. Buy some items above!
            </p>
          ) : (
            items
              .filter(i => i.quantity > 0)
              .map((inv) => {
                const itemDef = ITEM_MAP.get(inv.item_type)
                if (!itemDef) return null
                return (
                  <div key={inv.item_type} className="shop-inventory-item">
                    <span className="shop-inventory-emoji">{itemDef.emoji}</span>
                    <span className="shop-inventory-name">{itemDef.name}</span>
                    <span className="shop-inventory-qty">x{inv.quantity}</span>
                    {itemDef.category === 'potion' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleUsePotion(itemDef)}
                        disabled={usingPotion === itemDef.type}
                      >
                        Use
                      </button>
                    )}
                  </div>
                )
              })
          )}
        </div>
      </div>

      {/* Gold Checkout Modal */}
      {user && (
        <GoldCheckoutModal
          isOpen={!!checkoutPkg}
          onClose={() => setCheckoutPkg(null)}
          package={checkoutPkg}
          userId={user.id}
          onSuccess={handleGoldPurchaseSuccess}
        />
      )}
    </div>
  )
}
