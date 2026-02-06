'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useGold } from '@/hooks/useGold'
import { useInventory } from '@/hooks/useInventory'
import { useCredits } from '@/hooks/useCredits'
import { useModalStore } from '@/stores/modalStore'
import { ITEMS, WEAPONS, POTIONS, DEFENSE_ITEMS, UTILITY_ITEMS, GOLD_PACKAGES, SPIT_TO_GOLD_RATIO, ITEM_MAP, MAX_HP } from '@/lib/items'
import { ItemCard } from '@/components/shop/ItemCard'
import { GoldCheckoutModal } from '@/components/shop/GoldCheckoutModal'
import { StripeCheckoutModal } from '@/components/StripeCheckoutModal'
import { HPBar } from '@/components/ui/HPBar'
import { GameItem } from '@/lib/items'
import { UserChest, CreditTransaction } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'

const supabase = createClient()

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 199, name: 'Starter Pack', description: 'Perfect for trying things out' },
  { id: 'popular', credits: 500, price: 799, name: 'Popular Pack', description: 'Best value for active users', popular: true },
  { id: 'mega', credits: 1500, price: 1999, name: 'Mega Pack', description: 'For power users' },
  { id: 'whale', credits: 5000, price: 4999, name: 'Whale Pack', description: 'Ultimate spitting power', whale: true },
]

const TXN_TYPE_LABELS: Record<string, string> = {
  purchase: 'Purchased Spits',
  post: 'Posted Spit',
  reply: 'Replied',
  respit: 'Respit',
  like: 'Liked',
  pin_purchase: 'Promoted Spit',
  convert: 'Converted to Gold',
  like_reward: 'Like Reward',
  transfer_sent: 'Sent Transfer',
  transfer_received: 'Received Transfer',
  free_monthly: 'Monthly Bonus',
  chest_purchase: 'Bought Chest',
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function ShopPageContent() {
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const { balance: goldBalance, addGold, deductGold, hasGold, refreshBalance: refreshGold } = useGold()
  const { balance: creditBalance, deductAmount, refreshBalance: refreshCredits } = useCredits()
  const { items, refreshInventory, getQuantity } = useInventory()

  const { openChestOpenModal } = useModalStore()
  const { playSound } = useSound()
  const { awardXP } = useXP()
  const [convertAmount, setConvertAmount] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [buyingItem, setBuyingItem] = useState<string | null>(null)
  const [usingPotion, setUsingPotion] = useState<string | null>(null)
  const [activatingDefense, setActivatingDefense] = useState<string | null>(null)
  const [checkoutPkg, setCheckoutPkg] = useState<typeof GOLD_PACKAGES[number] | null>(null)
  const [userHp, setUserHp] = useState(user?.hp ?? MAX_HP)
  const [unopenedChests, setUnopenedChests] = useState<UserChest[]>([])
  const [buyingChest, setBuyingChest] = useState(false)

  // Credit purchase state
  const [selectedCreditPkg, setSelectedCreditPkg] = useState<typeof CREDIT_PACKAGES[0] | null>(null)
  const [isCreditCheckoutOpen, setIsCreditCheckoutOpen] = useState(false)

  // Transaction history state
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingTxns, setLoadingTxns] = useState(true)
  const [showAllTxns, setShowAllTxns] = useState(false)

  // Handle Stripe redirect URL params
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const credits = searchParams.get('credits')

    if (success === 'true' && credits) {
      toast.success(`Successfully purchased ${parseInt(credits).toLocaleString()} spits!`)
      playSound('gold')
      refreshCredits()
      fetchTransactions()
      window.history.replaceState({}, '', '/shop')
    } else if (canceled === 'true') {
      toast.warning('Purchase canceled. No charges were made.')
      window.history.replaceState({}, '', '/shop')
    }
  }, [searchParams])

  // Sync HP when user loads
  useEffect(() => {
    if (user?.hp !== undefined) setUserHp(user.hp)
  }, [user?.hp])

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

  // Fetch transaction history
  const fetchTransactions = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setTransactions(data)
    setLoadingTxns(false)
  }, [user])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

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
    const credited = await deductAmount(actualSpitCost, 'convert', 'gold_convert')
    if (!credited) {
      toast.warning('Insufficient spits!')
      setIsConverting(false)
      return
    }

    // Add gold
    const added = await addGold(goldToGet, 'convert')
    if (!added) {
      toast.error('Failed to add gold. Your spits were deducted — contact support.')
    } else {
      playSound('gold')
    }

    setConvertAmount('')
    setIsConverting(false)
  }

  const handleBuyItem = async (item: GameItem) => {
    if (!user || buyingItem) return
    if (!hasGold(item.goldCost)) {
      toast.warning('Insufficient gold!')
      return
    }

    setBuyingItem(item.type)

    // Deduct gold
    const deducted = await deductGold(item.goldCost, 'item_purchase', item.type)
    if (!deducted) {
      toast.error('Failed to purchase item.')
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
      toast.error('Failed to add item to inventory.')
    } else {
      playSound('gold')
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
      playSound('potion')
      awardXP('potion_use')
      setUserHp(data.newHp)
      await refreshInventory()
      toast.success(`Healed for ${data.healed} HP! New HP: ${data.newHp}`)
    } else {
      toast.error(data.error || 'Failed to use potion.')
    }

    setUsingPotion(null)
  }

  const handleActivateDefense = async (item: GameItem) => {
    if (!user || activatingDefense) return

    setActivatingDefense(item.type)

    const res = await fetch('/api/use-defense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type }),
    })

    const data = await res.json()

    if (data.success) {
      playSound('gold')
      await refreshInventory()
      toast.success(`${item.name} activated! ${data.charges} charge${data.charges > 1 ? 's' : ''} remaining.`)
    } else {
      toast.error(data.error || 'Failed to activate defense.')
    }

    setActivatingDefense(null)
  }

  const handleUseItem = async (item: GameItem) => {
    if (item.category === 'potion') {
      handleUsePotion(item)
    } else if (item.category === 'defense') {
      handleActivateDefense(item)
    }
  }

  const handleGoldPurchaseSuccess = async (gold: number) => {
    playSound('gold')
    await refreshGold()
    setCheckoutPkg(null)
    toast.success(`${gold} Gold added to your balance!`)
  }

  const handleBuyChest = async () => {
    if (!user || buyingChest) return
    if (creditBalance < 100) {
      toast.warning('Insufficient spits! Chests cost 100 spits.')
      return
    }

    setBuyingChest(true)

    try {
      const res = await fetch('/api/buy-chest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        playSound('chest')
        await refreshCredits()
        await fetchChests()
        window.dispatchEvent(new CustomEvent('chest-claimed'))
      } else {
        toast.error(data.error || 'Failed to buy chest')
      }
    } catch {
      toast.error('Network error')
    }

    setBuyingChest(false)
  }

  const handleCreditPurchase = (pkg: typeof CREDIT_PACKAGES[0]) => {
    if (!user) {
      toast.error('Please sign in to purchase credits')
      return
    }
    setSelectedCreditPkg(pkg)
    setIsCreditCheckoutOpen(true)
  }

  const handleCreditPurchaseSuccess = async (credits: number) => {
    setIsCreditCheckoutOpen(false)
    setSelectedCreditPkg(null)
    playSound('gold')
    await refreshCredits()
    await fetchTransactions()
    toast.success(`${credits.toLocaleString()} spits added to your balance!`)
  }

  const goldFromSpits = convertAmount ? Math.floor(parseInt(convertAmount, 10) / SPIT_TO_GOLD_RATIO) || 0 : 0
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const visibleTxns = showAllTxns ? transactions : transactions.slice(0, 5)

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span style={{ marginRight: '0.5rem' }}>🏪</span>
          Shop
        </h1>
      </header>

      {/* Balance Panel */}
      <div className="shop-balance-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="shop-gold-display">
            <span className="shop-gold-icon">🪙</span>
            <span className="shop-gold-amount">{goldBalance.toLocaleString()}</span>
            <span className="shop-gold-label">Gold</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⭐</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--sys-text)' }}>{creditBalance.toLocaleString()}</span>
            <span style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem' }}>Spits</span>
          </div>
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

      {/* Buy Chest */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🎁</span> Buy Treasure Chest
        </h2>
        <p className="shop-section-desc">Purchase a treasure chest for 100 spits. Contains 2-3 random rewards!</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🎁</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--sys-text)' }}>Treasure Chest</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--sys-text-muted)' }}>100 spits</div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-glow"
            onClick={handleBuyChest}
            disabled={buyingChest || creditBalance < 100}
            style={{ marginLeft: 'auto' }}
          >
            {buyingChest ? 'Buying...' : 'Buy Chest'}
          </button>
        </div>
      </div>

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

      {/* Buy Spits with Stripe */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>⭐</span> Buy Spits
        </h2>
        <p className="shop-section-desc">Spits never expire. Secure checkout powered by Stripe.</p>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className="panel"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                border: pkg.popular ? '2px solid var(--sys-primary)' : pkg.whale ? '2px solid var(--sys-warning)' : '1px solid var(--sys-border)',
                background: pkg.whale ? 'linear-gradient(135deg, rgba(255, 204, 0, 0.05), rgba(255, 136, 0, 0.05))' : undefined,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onClick={() => handleCreditPurchase(pkg)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = pkg.whale
                  ? '0 4px 20px rgba(255, 204, 0, 0.3)'
                  : '0 4px 20px rgba(0, 255, 136, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {pkg.whale && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '200%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255, 204, 0, 0.1), transparent)',
                    animation: 'shimmer 3s infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--sys-text)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {pkg.credits.toLocaleString()} Spits
                  {pkg.popular && <span className="badge badge-glow">Popular</span>}
                  {pkg.whale && <span className="badge" style={{ background: 'var(--sys-warning)', color: '#000' }}>Best Deal</span>}
                </div>
                <div style={{ color: 'var(--sys-text-muted)', marginTop: '0.15rem', fontSize: '0.85rem' }}>{pkg.description}</div>
              </div>

              <button
                className={`btn ${pkg.whale ? 'btn-warning' : 'btn-primary'} btn-glow`}
                style={{ minWidth: '70px', position: 'relative', zIndex: 1 }}
              >
                {formatPrice(pkg.price)}
              </button>
            </div>
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

      {/* Defense */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🛡️</span> Defense
        </h2>
        <div className="shop-items-grid">
          {DEFENSE_ITEMS.map((item) => (
            <ItemCard
              key={item.type}
              item={item}
              quantity={getQuantity(item.type)}
              goldBalance={goldBalance}
              onBuy={handleBuyItem}
              onUse={handleActivateDefense}
              buying={buyingItem === item.type}
            />
          ))}
        </div>
      </div>

      {/* Utility */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🎨</span> Utility
        </h2>
        <div className="shop-items-grid">
          {UTILITY_ITEMS.map((item) => (
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
                    {itemDef.category === 'defense' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleActivateDefense(itemDef)}
                        disabled={activatingDefense === itemDef.type}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                )
              })
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>📜</span> Transaction History
        </h2>
        {loadingTxns ? (
          <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center', padding: '1.5rem' }}>
            Loading...
          </p>
        ) : transactions.length === 0 ? (
          <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center', padding: '1.5rem' }}>
            No transactions yet.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {visibleTxns.map((txn) => (
                <div
                  key={txn.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem',
                    borderBottom: '1px solid var(--sys-border)',
                    fontFamily: 'var(--sys-font-mono)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span style={{
                      color: txn.amount >= 0 ? 'var(--sys-success)' : 'var(--sys-error)',
                      fontWeight: 'bold',
                      minWidth: '60px',
                      textAlign: 'right',
                    }}>
                      {txn.amount >= 0 ? '+' : ''}{txn.amount}
                    </span>
                    <span style={{ color: 'var(--sys-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {TXN_TYPE_LABELS[txn.type] || txn.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{ color: 'var(--sys-text-muted)', fontSize: '0.8rem' }}>
                      bal: {txn.balance_after}
                    </span>
                    <span style={{ color: 'var(--sys-text-muted)', fontSize: '0.75rem', minWidth: '50px', textAlign: 'right' }}>
                      {timeAgo(txn.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {transactions.length > 5 && !showAllTxns && (
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: '0.75rem' }}
                onClick={() => setShowAllTxns(true)}
              >
                Show More ({transactions.length - 5} more)
              </button>
            )}
          </>
        )}
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

      {/* Spit Credit Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isCreditCheckoutOpen}
        onClose={() => {
          setIsCreditCheckoutOpen(false)
          setSelectedCreditPkg(null)
        }}
        package={selectedCreditPkg}
        userId={user?.id || ''}
        onSuccess={handleCreditPurchaseSuccess}
      />
    </div>
  )
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <span className="text-glow">Loading...</span>
      </div>
    }>
      <ShopPageContent />
    </Suspense>
  )
}
