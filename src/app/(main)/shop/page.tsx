'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useGold } from '@/hooks/useGold'
import { useInventory } from '@/hooks/useInventory'
import { useCredits } from '@/hooks/useCredits'
import { useModalStore } from '@/stores/modalStore'
import { WEAPONS, POTIONS, DEFENSE_ITEMS, POWERUP_ITEMS, UTILITY_ITEMS, GOLD_PACKAGES, SPIT_TO_GOLD_RATIO, ITEM_MAP, getMaxHp } from '@/lib/items'
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
import { NameTagModal } from '@/components/shop/NameTagModal'
import { useCreditCard } from '@/hooks/useCreditCard'
import { getAvailableCredit } from '@/lib/creditCard'

const supabase = createClient()

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 1000, price: 199, name: 'Starter Pack', description: 'Perfect for trying things out' },
  { id: 'popular', credits: 5000, price: 799, name: 'Popular Pack', description: 'Best value for active users', popular: true },
  { id: 'mega', credits: 15000, price: 1999, name: 'Mega Pack', description: 'For power users' },
  { id: 'whale', credits: 50000, price: 4999, name: 'Whale Pack', description: 'Ultimate spitting power', whale: true },
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
  level_up: 'Level Up Reward',
}

type ShopTab = 'weapons' | 'potions' | 'defense' | 'powerups' | 'utility'

const SHOP_TABS: { key: ShopTab; label: string; emoji: string }[] = [
  { key: 'weapons', label: 'Weapons', emoji: '⚔️' },
  { key: 'potions', label: 'Potions', emoji: '🧪' },
  { key: 'defense', label: 'Defense', emoji: '🛡️' },
  { key: 'powerups', label: 'Power-Ups', emoji: '🔴' },
  { key: 'utility', label: 'Utility', emoji: '🎨' },
]

const TAB_ITEMS: Record<ShopTab, GameItem[]> = {
  weapons: WEAPONS,
  potions: POTIONS,
  defense: DEFENSE_ITEMS,
  powerups: POWERUP_ITEMS,
  utility: UTILITY_ITEMS,
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
  const { awardXP, level: userLevel } = useXP()
  const [convertAmount, setConvertAmount] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [buyingItem, setBuyingItem] = useState<string | null>(null)
  const [usingPotion, setUsingPotion] = useState<string | null>(null)
  const [activatingDefense, setActivatingDefense] = useState<string | null>(null)
  const [activatingPowerup, setActivatingPowerup] = useState<string | null>(null)
  const [checkoutPkg, setCheckoutPkg] = useState<typeof GOLD_PACKAGES[number] | null>(null)
  const [userHp, setUserHp] = useState(user?.hp ?? getMaxHp(userLevel))
  const [unopenedChests, setUnopenedChests] = useState<UserChest[]>([])
  const [buyingChest, setBuyingChest] = useState(false)
  const [activeTab, setActiveTab] = useState<ShopTab>('weapons')

  // Credit card
  const { card: ccCard, refresh: refreshCC } = useCreditCard()
  const [payMethod, setPayMethod] = useState<'gold' | 'credit'>('gold')
  const ccAvailable = ccCard ? getAvailableCredit(ccCard.credit_limit, ccCard.current_balance) : 0

  // Name tag modal
  const [showNameTagModal, setShowNameTagModal] = useState(false)

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

  const handleConvert = async () => {
    if (!user || isConverting) return
    const spitsToConvert = parseInt(convertAmount, 10)
    if (isNaN(spitsToConvert) || spitsToConvert < SPIT_TO_GOLD_RATIO) return

    const goldToGet = Math.floor(spitsToConvert / SPIT_TO_GOLD_RATIO)
    const actualSpitCost = goldToGet * SPIT_TO_GOLD_RATIO

    setIsConverting(true)

    const credited = await deductAmount(actualSpitCost, 'convert', 'gold_convert')
    if (!credited) {
      toast.warning('Insufficient spits!')
      setIsConverting(false)
      return
    }

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

    const useCredit = payMethod === 'credit' && ccCard

    if (useCredit) {
      if (ccAvailable < item.goldCost) {
        toast.warning('Insufficient credit!')
        return
      }
    } else {
      if (!hasGold(item.goldCost)) {
        toast.warning('Insufficient gold!')
        return
      }
    }

    setBuyingItem(item.type)

    if (useCredit) {
      // Pay via credit card
      try {
        const res = await fetch('/api/credit-card/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: item.goldCost,
            description: `Shop: ${item.name}`,
            referenceId: item.type,
          }),
        })
        const data = await res.json()
        if (!data.success) {
          toast.error(data.error || 'Credit purchase failed')
          setBuyingItem(null)
          return
        }
      } catch {
        toast.error('Network error')
        setBuyingItem(null)
        return
      }
    } else {
      // Pay via gold wallet
      const deducted = await deductGold(item.goldCost, 'item_purchase', item.type)
      if (!deducted) {
        toast.error('Failed to purchase item.')
        setBuyingItem(null)
        return
      }
    }

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
      if (useCredit) await refreshCC()
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
      playSound('shield')
      await refreshInventory()
      toast.success(`${item.name} activated! ${data.charges} charge${data.charges > 1 ? 's' : ''} remaining.`)
    } else {
      toast.error(data.error || 'Failed to activate defense.')
    }

    setActivatingDefense(null)
  }

  const handleActivatePowerup = async (item: GameItem) => {
    if (!user || activatingPowerup) return

    setActivatingPowerup(item.type)

    const res = await fetch('/api/use-powerup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type }),
    })

    const data = await res.json()

    if (data.success) {
      playSound('shield')
      await refreshInventory()
      toast.success(`${item.name} activated! ${data.charges} charge${data.charges > 1 ? 's' : ''}.`)
    } else {
      toast.error(data.error || 'Failed to activate power-up.')
    }

    setActivatingPowerup(null)
  }

  const handleUseUtility = async (item: GameItem) => {
    if (!user) return

    if (item.type === 'smoke_bomb') {
      const res = await fetch('/api/use-smoke-bomb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        playSound('shield')
        await refreshInventory()
        toast.success(`Smoke Bomb used! Cleared ${data.cleared} spray paint${data.cleared !== 1 ? 's' : ''}.`)
      } else {
        toast.error(data.error || 'Failed to use smoke bomb.')
      }
    } else if (item.type === 'fake_death') {
      const res = await fetch('/api/use-fake-death', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        playSound('shield')
        await refreshInventory()
        toast.success(`Fake Death activated for ${data.duration}!`)
      } else {
        toast.error(data.error || 'Failed to activate Fake Death.')
      }
    } else if (item.type === 'name_tag') {
      setShowNameTagModal(true)
    }
  }

  const handleUseItem = async (item: GameItem) => {
    if (item.category === 'potion') {
      handleUsePotion(item)
    } else if (item.category === 'defense') {
      handleActivateDefense(item)
    } else if (item.category === 'powerup') {
      handleActivatePowerup(item)
    } else if (item.category === 'utility') {
      handleUseUtility(item)
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
  const inventoryItems = items.filter(i => i.quantity > 0)

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
          <HPBar hp={userHp} maxHp={getMaxHp(userLevel)} size="md" />
        </div>
        {ccCard && (
          <div className="shop-payment-toggle">
            <span style={{ fontSize: '0.7rem', color: 'var(--sys-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pay with:</span>
            <div className="shop-pay-tabs">
              <button
                className={`shop-pay-tab ${payMethod === 'gold' ? 'shop-pay-tab-active' : ''}`}
                onClick={() => setPayMethod('gold')}
              >
                🪙 Gold ({goldBalance.toLocaleString()})
              </button>
              <button
                className={`shop-pay-tab ${payMethod === 'credit' ? 'shop-pay-tab-active' : ''}`}
                onClick={() => setPayMethod('credit')}
              >
                💳 Credit ({ccAvailable.toLocaleString()})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inventory */}
      {inventoryItems.length > 0 && (
        <div className="shop-section">
          <h2 className="shop-section-title">
            <span>🎒</span> Inventory
          </h2>
          <div className="shop-inv-list">
            {inventoryItems.map((inv) => {
              const itemDef = ITEM_MAP.get(inv.item_type)
              if (!itemDef) return null
              const canUse = itemDef.category === 'potion' || itemDef.category === 'defense' || itemDef.category === 'powerup' || (itemDef.category === 'utility' && ['smoke_bomb', 'fake_death', 'name_tag'].includes(itemDef.type))
              return (
                <div key={inv.item_type} className="shop-inv-row">
                  <span className="shop-inv-row-icon">{itemDef.emoji}</span>
                  <span className="shop-inv-row-name">{itemDef.name}</span>
                  <span className="shop-inv-row-qty">x{inv.quantity}</span>
                  {canUse && (
                    <button
                      className="btn btn-primary shop-inv-row-btn"
                      onClick={() => handleUseItem(itemDef)}
                      disabled={
                        (itemDef.category === 'potion' && usingPotion === itemDef.type) ||
                        (itemDef.category === 'defense' && activatingDefense === itemDef.type) ||
                        (itemDef.category === 'powerup' && activatingPowerup === itemDef.type)
                      }
                    >
                      {itemDef.category === 'defense' ? 'Equip' : 'Use'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* Tabbed Item Shop */}
      <div className="shop-section">
        <div className="shop-tabs">
          {SHOP_TABS.map((t) => (
            <button
              key={t.key}
              className={`shop-tab ${activeTab === t.key ? 'shop-tab-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
        <div className="shop-items-list">
          {TAB_ITEMS[activeTab].map((item) => (
            <ItemCard
              key={item.type}
              item={item}
              quantity={getQuantity(item.type)}
              goldBalance={goldBalance}
              onBuy={handleBuyItem}
              onUse={handleUseItem}
              buying={buyingItem === item.type}
            />
          ))}
        </div>
      </div>

      {/* Treasure Chest */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🎁</span> Treasure Chest
        </h2>
        <div className="shop-item-row">
          <div className="shop-item-icon">🎁</div>
          <div className="shop-item-info">
            <div className="shop-item-name">Random Chest</div>
            <div className="shop-item-meta">
              <span className="shop-item-stat-effect">2-3 random rewards</span>
            </div>
          </div>
          <div className="shop-item-right">
            <span className="shop-item-cost" style={{ color: 'var(--sys-text)' }}>100 spits</span>
            <button
              className="btn btn-primary"
              onClick={handleBuyChest}
              disabled={buyingChest || creditBalance < 100}
            >
              {buyingChest ? '...' : 'Buy'}
            </button>
          </div>
        </div>
      </div>

      {/* Convert Spits → Gold */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🔄</span> Convert Spits → Gold
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--sys-text-muted)', margin: '0 0 0.75rem' }}>
          Rate: {SPIT_TO_GOLD_RATIO} spits = 1 gold
        </p>
        <div className="shop-convert-row">
          <input
            type="number"
            className="input"
            value={convertAmount}
            onChange={(e) => setConvertAmount(e.target.value)}
            placeholder={`Min ${SPIT_TO_GOLD_RATIO}`}
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

      {/* Buy Gold */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>🪙</span> Buy Gold
        </h2>
        <div className="shop-packages-compact">
          {GOLD_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              className={`shop-pkg-compact ${pkg.popular ? 'shop-pkg-highlight' : ''} ${pkg.whale ? 'shop-pkg-whale' : ''}`}
              onClick={() => setCheckoutPkg(pkg)}
            >
              <span className="shop-pkg-compact-amount">{pkg.gold.toLocaleString()}g</span>
              <span className="shop-pkg-compact-price">${(pkg.price / 100).toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Buy Spits */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>⭐</span> Buy Spits
        </h2>
        <div className="shop-packages-compact">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              className={`shop-pkg-compact ${pkg.popular ? 'shop-pkg-highlight' : ''} ${pkg.whale ? 'shop-pkg-whale' : ''}`}
              onClick={() => handleCreditPurchase(pkg)}
            >
              <span className="shop-pkg-compact-amount">{pkg.credits.toLocaleString()}</span>
              <span className="shop-pkg-compact-price">${(pkg.price / 100).toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="shop-section">
        <h2 className="shop-section-title">
          <span>📜</span> Transaction History
        </h2>
        {loadingTxns ? (
          <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>Loading...</p>
        ) : transactions.length === 0 ? (
          <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>No transactions yet.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleTxns.map((txn) => (
                <div key={txn.id} className="shop-txn-row">
                  <span className="shop-txn-amount" style={{
                    color: txn.amount >= 0 ? 'var(--sys-success)' : 'var(--sys-error)',
                  }}>
                    {txn.amount >= 0 ? '+' : ''}{txn.amount}
                  </span>
                  <span className="shop-txn-label">
                    {TXN_TYPE_LABELS[txn.type] || txn.type}
                  </span>
                  <span className="shop-txn-time">
                    {timeAgo(txn.created_at)}
                  </span>
                </div>
              ))}
            </div>
            {transactions.length > 5 && !showAllTxns && (
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem' }}
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

      {/* Name Tag Modal */}
      {showNameTagModal && user && (
        <NameTagModal
          onClose={() => setShowNameTagModal(false)}
          onSuccess={async () => {
            await refreshInventory()
            setShowNameTagModal(false)
          }}
        />
      )}
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
