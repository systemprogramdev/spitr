'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCredits } from '@/hooks/useCredits'
import { useGold } from '@/hooks/useGold'
import { SPIT_TO_GOLD_RATIO } from '@/lib/items'
import { useBank } from '@/hooks/useBank'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'
import {
  getCurrentDailyRate,
  formatRate,
  calculateBankBalance,
  calculateInterest,
  getStockPrice,
  TICKET_TIERS,
  CD_TIERS,
  BankBalance,
} from '@/lib/bank'
import { InterestTicker, DepositRowTicker } from '@/components/bank/InterestTicker'
import { StockChart } from '@/components/bank/StockChart'
import { ScratchCard } from '@/components/bank/ScratchCard'

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function BankPage() {
  const { user } = useAuthStore()
  const { balance: walletSpits, deductAmount, addAmount, refreshBalance: refreshCredits } = useCredits()
  const { balance: walletGold, deductGold, addGold, refreshBalance: refreshGold } = useGold()
  const {
    spitDeposits,
    goldDeposits,
    stockHolding,
    unscratchedTickets,
    activeCDs,
    loaded,
    refresh: refreshBank,
    getSpitBankBalance,
    getGoldBankBalance,
  } = useBank()
  const { playSound } = useSound()
  const { awardXP } = useXP()

  // Ticking state
  const [currentRate, setCurrentRate] = useState(getCurrentDailyRate())
  const [stockPrice, setStockPrice] = useState(getStockPrice())
  const [spitBank, setSpitBank] = useState<BankBalance>({ totalPrincipal: 0, totalInterest: 0, totalBalance: 0, totalWithdrawn: 0 })
  const [goldBank, setGoldBank] = useState<BankBalance>({ totalPrincipal: 0, totalInterest: 0, totalBalance: 0, totalWithdrawn: 0 })

  // Forms
  const [depositTab, setDepositTab] = useState<'spit' | 'gold'>('spit')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [buyStockAmount, setBuyStockAmount] = useState('')
  const [sellSharesAmount, setSellSharesAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isBuyingStock, setIsBuyingStock] = useState(false)
  const [isSellingStock, setIsSellingStock] = useState(false)
  const [buyingTicket, setBuyingTicket] = useState<string | null>(null)
  const [chartDays, setChartDays] = useState(30)
  const [scratchedIds, setScratchedIds] = useState<Set<string>>(new Set())
  const [spitToGoldAmount, setSpitToGoldAmount] = useState('')
  const [goldToSpitAmount, setGoldToSpitAmount] = useState('')
  const [isConvertingToGold, setIsConvertingToGold] = useState(false)
  const [isConvertingToSpit, setIsConvertingToSpit] = useState(false)
  const [cdCurrency, setCdCurrency] = useState<'spit' | 'gold'>('spit')
  const [cdAmount, setCdAmount] = useState('')
  const [cdTerm, setCdTerm] = useState(7)
  const [isBuyingCD, setIsBuyingCD] = useState(false)
  const [redeemingCdId, setRedeemingCdId] = useState<string | null>(null)
  const [isPurgingDust, setIsPurgingDust] = useState(false)

  // Tick rate + stock price every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRate(getCurrentDailyRate())
      setStockPrice(getStockPrice())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Tick bank balances every 100ms for real-time yield
  useEffect(() => {
    const tick = () => {
      setSpitBank(getSpitBankBalance())
      setGoldBank(getGoldBankBalance())
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [spitDeposits, goldDeposits])

  // ---- Handlers ----

  const handleDeposit = async () => {
    const amount = parseInt(depositAmount)
    if (!amount || amount <= 0) return
    setIsDepositing(true)
    try {
      const res = await fetch('/api/bank/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: depositTab, amount }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Deposited ${amount} ${depositTab} at ${formatRate(data.lockedRate)}`)
        playSound('gold')
        awardXP('bank_deposit')
        setDepositAmount('')
        refreshBank()
        if (depositTab === 'spit') refreshCredits()
        else refreshGold()
      } else {
        toast.error(data.error || 'Deposit failed')
      }
    } catch {
      toast.error('Deposit failed')
    } finally {
      setIsDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount)
    if (!amount || amount <= 0) return
    setIsWithdrawing(true)
    try {
      const res = await fetch('/api/bank/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: depositTab, amount }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Withdrew ${data.withdrawn} ${depositTab} to wallet`)
        playSound('gold')
        awardXP('bank_withdraw')
        setWithdrawAmount('')
        refreshBank()
        if (depositTab === 'spit') refreshCredits()
        else refreshGold()
      } else {
        toast.error(data.error || 'Withdrawal failed')
      }
    } catch {
      toast.error('Withdrawal failed')
    } finally {
      setIsWithdrawing(false)
    }
  }

  const handleBuyStock = async () => {
    const amount = parseFloat(buyStockAmount)
    if (!amount || amount <= 0) return
    setIsBuyingStock(true)
    try {
      const res = await fetch('/api/bank/buy-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spitAmount: amount }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Bought ${Number(data.sharesBought).toFixed(2)} shares at ${data.pricePerShare}/share`)
        playSound('gold')
        awardXP('stock_buy')
        setBuyStockAmount('')
        refreshBank()
      } else {
        toast.error(data.error || 'Stock purchase failed')
      }
    } catch {
      toast.error('Stock purchase failed')
    } finally {
      setIsBuyingStock(false)
    }
  }

  const handleSellStock = async () => {
    const shares = parseFloat(sellSharesAmount)
    if (!shares || shares <= 0) return
    setIsSellingStock(true)
    try {
      const res = await fetch('/api/bank/sell-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Sold ${Number(data.sharesSold).toFixed(2)} shares for ${Number(data.proceeds).toFixed(2)} spits`)
        playSound('gold')
        awardXP('stock_sell')
        setSellSharesAmount('')
        refreshBank()
      } else {
        toast.error(data.error || 'Stock sale failed')
      }
    } catch {
      toast.error('Stock sale failed')
    } finally {
      setIsSellingStock(false)
    }
  }

  const handleBuyTicket = async (ticketType: string) => {
    setBuyingTicket(ticketType)
    try {
      const res = await fetch('/api/bank/buy-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketType }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Ticket purchased!')
        playSound('paper')
        awardXP('ticket_buy')
        refreshBank()
      } else {
        toast.error(data.error || 'Ticket purchase failed')
      }
    } catch {
      toast.error('Ticket purchase failed')
    } finally {
      setBuyingTicket(null)
    }
  }

  const handleTicketScratched = (ticketId: string) => {
    awardXP('ticket_scratch')
    setScratchedIds(prev => new Set(prev).add(ticketId))
    refreshBank()
  }

  const handleConvertToGold = async () => {
    if (!user || isConvertingToGold) return
    const spits = parseInt(spitToGoldAmount, 10)
    if (isNaN(spits) || spits < SPIT_TO_GOLD_RATIO) return

    const goldToGet = Math.floor(spits / SPIT_TO_GOLD_RATIO)
    const actualCost = goldToGet * SPIT_TO_GOLD_RATIO

    setIsConvertingToGold(true)
    const deducted = await deductAmount(actualCost, 'convert', 'gold_convert')
    if (!deducted) {
      toast.warning('Insufficient spits!')
      setIsConvertingToGold(false)
      return
    }
    const added = await addGold(goldToGet, 'convert')
    if (!added) {
      toast.error('Failed to add gold')
    } else {
      toast.success(`Converted ${actualCost} spits → ${goldToGet} gold`)
      playSound('gold')
    }
    setSpitToGoldAmount('')
    setIsConvertingToGold(false)
  }

  const handleConvertToSpit = async () => {
    if (!user || isConvertingToSpit) return
    const gold = parseInt(goldToSpitAmount, 10)
    if (isNaN(gold) || gold < 1) return

    const spitsToGet = gold * SPIT_TO_GOLD_RATIO

    setIsConvertingToSpit(true)
    const deducted = await deductGold(gold, 'convert', 'spit_convert')
    if (!deducted) {
      toast.warning('Insufficient gold!')
      setIsConvertingToSpit(false)
      return
    }
    const added = await addAmount(spitsToGet, 'convert', 'gold_convert')
    if (!added) {
      toast.error('Failed to add spits')
    } else {
      toast.success(`Converted ${gold} gold → ${spitsToGet} spits`)
      playSound('gold')
    }
    setGoldToSpitAmount('')
    setIsConvertingToSpit(false)
  }

  const handleBuyCD = async () => {
    const amount = parseInt(cdAmount)
    if (!amount || amount <= 0) return
    setIsBuyingCD(true)
    try {
      const res = await fetch('/api/bank/buy-cd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: cdCurrency, amount, termDays: cdTerm }),
      })
      const data = await res.json()
      if (data.success) {
        const tier = CD_TIERS.find(t => t.termDays === cdTerm)
        toast.success(`Locked ${amount} ${cdCurrency} in ${tier?.name || 'CD'}`)
        playSound('gold')
        awardXP('cd_buy')
        setCdAmount('')
        refreshBank()
        if (cdCurrency === 'spit') refreshCredits()
        else refreshGold()
      } else {
        toast.error(data.error || 'CD purchase failed')
      }
    } catch {
      toast.error('CD purchase failed')
    } finally {
      setIsBuyingCD(false)
    }
  }

  const handleRedeemCD = async (cdId: string) => {
    setRedeemingCdId(cdId)
    try {
      const res = await fetch('/api/bank/redeem-cd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cdId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Redeemed CD: ${data.payout} (${data.principal} + ${data.bonus} bonus)`)
        playSound('gold')
        awardXP('cd_redeem')
        refreshBank()
        refreshCredits()
        refreshGold()
      } else {
        toast.error(data.error || 'CD redemption failed')
      }
    } catch {
      toast.error('CD redemption failed')
    } finally {
      setRedeemingCdId(null)
    }
  }

  const handlePurgeDust = async () => {
    setIsPurgingDust(true)
    try {
      const res = await fetch('/api/bank/purge-dust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Purged ${data.purged} dust deposit${data.purged === 1 ? '' : 's'}`)
        refreshBank()
      } else {
        toast.error(data.error || 'Purge failed')
      }
    } catch {
      toast.error('Purge failed')
    } finally {
      setIsPurgingDust(false)
    }
  }

  // ---- Computed ----

  const currentShares = stockHolding?.shares || 0
  const costBasis = stockHolding?.total_cost_basis || 0
  const currentValue = currentShares * stockPrice
  const pnl = currentValue - costBasis
  const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0

  const allDeposits = depositTab === 'spit' ? spitDeposits : goldDeposits
  const activeDeposits = allDeposits.filter(d => {
    const interest = calculateInterest(d.principal, d.locked_rate, d.deposited_at)
    return d.principal + interest - d.withdrawn >= 0.01
  })
  const bankBalance = depositTab === 'spit' ? spitBank : goldBank
  const walletBalance = depositTab === 'spit' ? walletSpits : walletGold

  // Dust = deposits with remaining value > 0 but < 1 (across both currencies)
  const allDustCount = [...spitDeposits, ...goldDeposits].filter(d => {
    const interest = calculateInterest(d.principal, d.locked_rate, d.deposited_at)
    const remaining = d.principal + interest - d.withdrawn
    return remaining > 0 && remaining < 1
  }).length

  const ticketsToScratch = unscratchedTickets.filter(t => !scratchedIds.has(t.id))

  // Rate wave indicator (0-1 where in cycle)
  const ratePosition = (currentRate - 0.005) / (0.01 - 0.005)

  if (!loaded) {
    return (
      <div>
        <header className="feed-header">
          <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
            <span style={{ marginRight: '0.5rem' }}>🏦</span>
            Bank
          </h1>
        </header>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--sys-text-muted)' }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="feed-header">
        <h1 className="text-glow" style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--sys-font-display)' }}>
          <span style={{ marginRight: '0.5rem' }}>🏦</span>
          Bank
        </h1>
      </header>

      <div className="bank-content">

        {/* ============================================ */}
        {/* BALANCE OVERVIEW */}
        {/* ============================================ */}
        <section className="bank-section">
          <div className="bank-hero">
            <div className="bank-hero-col">
              <div className="bank-hero-label">Bank Balance (Spits)</div>
              <div className="bank-hero-value bank-hero-value-live">
                {spitBank.totalBalance.toFixed(5)}
              </div>
              {spitBank.totalInterest > 0 && (
                <div className="bank-hero-yield">+{spitBank.totalInterest.toFixed(5)} earned</div>
              )}
            </div>
            <div className="bank-hero-col">
              <div className="bank-hero-label">Bank Balance (Gold)</div>
              <div className="bank-hero-value bank-hero-value-live">
                {goldBank.totalBalance.toFixed(5)}
              </div>
              {goldBank.totalInterest > 0 && (
                <div className="bank-hero-yield">+{goldBank.totalInterest.toFixed(5)} earned</div>
              )}
            </div>
          </div>

          <div className="bank-wallets">
            <div className="bank-wallet-chip">
              <span className="bank-wallet-chip-label">Wallet</span>
              <span className="bank-wallet-chip-val">{walletSpits.toLocaleString()} spits</span>
            </div>
            <div className="bank-wallet-chip">
              <span className="bank-wallet-chip-label">Wallet</span>
              <span className="bank-wallet-chip-val">{walletGold.toLocaleString()} gold</span>
            </div>
          </div>

          {/* Rate */}
          <div className="bank-rate-bar">
            <div className="bank-rate-bar-info">
              <span className="bank-rate-bar-label">Interest Rate</span>
              <span className="bank-rate-bar-value">{formatRate(currentRate)}/day</span>
            </div>
            <div className="bank-rate-bar-track">
              <div className="bank-rate-bar-fill" style={{ width: `${ratePosition * 100}%` }} />
            </div>
            <div className="bank-rate-bar-range">
              <span>0.50%</span>
              <span>locked at deposit</span>
              <span>1.00%</span>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CONVERT */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Convert Currency</h2>

          <div className="bank-forms-row">
            {/* Spits → Gold */}
            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon bank-form-icon-buy">🔄</div>
                <div>
                  <h3 className="bank-form-title">Spits → Gold</h3>
                  <p className="bank-form-sub">{SPIT_TO_GOLD_RATIO} spits = 1 gold</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Spits to convert</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder={`Min ${SPIT_TO_GOLD_RATIO}`}
                    value={spitToGoldAmount}
                    onChange={(e) => setSpitToGoldAmount(e.target.value)}
                    min={SPIT_TO_GOLD_RATIO}
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setSpitToGoldAmount(String(walletSpits))}
                  >
                    MAX
                  </button>
                </div>
                {spitToGoldAmount && parseInt(spitToGoldAmount) >= SPIT_TO_GOLD_RATIO && (
                  <div className="bank-form-preview">
                    = {Math.floor(parseInt(spitToGoldAmount) / SPIT_TO_GOLD_RATIO)} gold
                  </div>
                )}
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleConvertToGold}
                  disabled={isConvertingToGold || !spitToGoldAmount || parseInt(spitToGoldAmount) < SPIT_TO_GOLD_RATIO || parseInt(spitToGoldAmount) > walletSpits}
                >
                  {isConvertingToGold ? 'Converting...' : 'Convert'}
                </button>
                <div className="bank-form-footer">
                  Wallet: <strong>{walletSpits.toLocaleString()}</strong> spits
                </div>
              </div>
            </div>

            {/* Gold → Spits */}
            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon bank-form-icon-sell">🔄</div>
                <div>
                  <h3 className="bank-form-title">Gold → Spits</h3>
                  <p className="bank-form-sub">1 gold = {SPIT_TO_GOLD_RATIO} spits</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Gold to convert</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="Min 1"
                    value={goldToSpitAmount}
                    onChange={(e) => setGoldToSpitAmount(e.target.value)}
                    min="1"
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setGoldToSpitAmount(String(walletGold))}
                  >
                    MAX
                  </button>
                </div>
                {goldToSpitAmount && parseInt(goldToSpitAmount) >= 1 && (
                  <div className="bank-form-preview">
                    = {parseInt(goldToSpitAmount) * SPIT_TO_GOLD_RATIO} spits
                  </div>
                )}
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleConvertToSpit}
                  disabled={isConvertingToSpit || !goldToSpitAmount || parseInt(goldToSpitAmount) < 1 || parseInt(goldToSpitAmount) > walletGold}
                >
                  {isConvertingToSpit ? 'Converting...' : 'Convert'}
                </button>
                <div className="bank-form-footer">
                  Wallet: <strong>{walletGold.toLocaleString()}</strong> gold
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* DEPOSIT / WITHDRAW */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Deposits & Withdrawals</h2>

          <div className="bank-tabs">
            <button
              className={`bank-tab ${depositTab === 'spit' ? 'active' : ''}`}
              onClick={() => setDepositTab('spit')}
            >
              Spits
            </button>
            <button
              className={`bank-tab ${depositTab === 'gold' ? 'active' : ''}`}
              onClick={() => setDepositTab('gold')}
            >
              Gold
            </button>
          </div>

          <div className="bank-forms-row">
            {/* Deposit */}
            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon">+</div>
                <div>
                  <h3 className="bank-form-title">Deposit</h3>
                  <p className="bank-form-sub">Locks at {formatRate(currentRate)}/day</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Amount ({depositTab})</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="1"
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setDepositAmount(String(walletBalance))}
                  >
                    MAX
                  </button>
                </div>
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleDeposit}
                  disabled={isDepositing || !depositAmount || Number(depositAmount) <= 0 || Number(depositAmount) > walletBalance}
                >
                  {isDepositing ? 'Depositing...' : 'Deposit'}
                </button>
                <div className="bank-form-footer">
                  Wallet: <strong>{walletBalance.toLocaleString()}</strong> {depositTab}
                </div>
              </div>
            </div>

            {/* Withdraw */}
            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon bank-form-icon-withdraw">-</div>
                <div>
                  <h3 className="bank-form-title">Withdraw</h3>
                  <p className="bank-form-sub">Floored to integer</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Amount ({depositTab})</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min="1"
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setWithdrawAmount(String(Math.floor(bankBalance.totalBalance)))}
                  >
                    MAX
                  </button>
                </div>
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > bankBalance.totalBalance}
                >
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                </button>
                <div className="bank-form-footer">
                  Bank: <strong>{bankBalance.totalBalance.toFixed(2)}</strong> {depositTab}
                </div>
              </div>
            </div>
          </div>

          {/* Active deposits with live ticking per row */}
          {activeDeposits.length > 0 && (
            <div className="bank-deposits-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="bank-deposits-list-title">
                  Active Deposits ({activeDeposits.length})
                </h3>
                {allDustCount > 0 && (
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', minHeight: 'unset' }}
                    onClick={handlePurgeDust}
                    disabled={isPurgingDust}
                    title="Delete deposits with less than 1 remaining"
                  >
                    {isPurgingDust ? '...' : `Purge Dust (${allDustCount})`}
                  </button>
                )}
              </div>
              <div className="bank-deposits-table-header">
                <span>Principal</span>
                <span>Rate</span>
                <span>Age</span>
                <span>Value</span>
              </div>
              {activeDeposits.map((d) => (
                <div key={d.id} className="bank-deposit-row">
                  <span className="bank-deposit-principal">{d.principal.toFixed(2)}</span>
                  <span className="bank-deposit-rate">{formatRate(d.locked_rate)}</span>
                  <span className="bank-deposit-time">{timeAgo(d.deposited_at)}</span>
                  <DepositRowTicker deposit={d} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* CERTIFICATES OF DEPOSIT */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Certificates of Deposit</h2>

          {/* CD Tier cards */}
          <div className="bank-cd-tiers">
            {CD_TIERS.map(tier => (
              <div
                key={tier.termDays}
                className={`bank-cd-tier-card ${cdTerm === tier.termDays ? 'active' : ''}`}
                onClick={() => setCdTerm(tier.termDays)}
              >
                <div className="bank-cd-tier-badge">{tier.termDays}d</div>
                <div className="bank-cd-tier-name">{tier.name}</div>
                <div className="bank-cd-tier-rate">{tier.description}</div>
              </div>
            ))}
          </div>

          {/* Buy form */}
          <div className="bank-cd-form">
            <div className="bank-cd-form-row">
              <div className="bank-cd-form-field">
                <label className="bank-form-label">Currency</label>
                <div className="bank-tabs">
                  <button
                    className={`bank-tab ${cdCurrency === 'spit' ? 'active' : ''}`}
                    onClick={() => setCdCurrency('spit')}
                  >
                    Spits
                  </button>
                  <button
                    className={`bank-tab ${cdCurrency === 'gold' ? 'active' : ''}`}
                    onClick={() => setCdCurrency('gold')}
                  >
                    Gold
                  </button>
                </div>
              </div>
              <div className="bank-cd-form-field" style={{ flex: 1 }}>
                <label className="bank-form-label">Amount ({cdCurrency})</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="0"
                    value={cdAmount}
                    onChange={(e) => setCdAmount(e.target.value)}
                    min="1"
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setCdAmount(String(cdCurrency === 'spit' ? walletSpits : walletGold))}
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>
            {cdAmount && parseInt(cdAmount) > 0 && (
              <div className="bank-form-preview">
                Payout: {Math.floor(parseInt(cdAmount) * (1 + (CD_TIERS.find(t => t.termDays === cdTerm)?.rate || 0)))} {cdCurrency} after {cdTerm} days
              </div>
            )}
            <button
              className="btn btn-primary bank-form-submit"
              onClick={handleBuyCD}
              disabled={isBuyingCD || !cdAmount || parseInt(cdAmount) <= 0 || parseInt(cdAmount) > (cdCurrency === 'spit' ? walletSpits : walletGold)}
            >
              {isBuyingCD ? 'Locking...' : `Lock in ${cdTerm}-Day CD`}
            </button>
            <div className="bank-form-footer">
              Wallet: <strong>{(cdCurrency === 'spit' ? walletSpits : walletGold).toLocaleString()}</strong> {cdCurrency}
            </div>
          </div>

          {/* Active CDs */}
          {activeCDs.length > 0 && (
            <div className="bank-cd-list">
              <h3 className="bank-deposits-list-title">
                Active CDs ({activeCDs.length})
              </h3>
              {activeCDs.map((cd) => {
                const maturesAt = new Date(cd.matures_at)
                const isMatured = new Date() >= maturesAt
                const bonus = Math.floor(cd.principal * cd.rate)
                const payout = Math.floor(cd.principal) + bonus
                const totalMs = cd.term_days * 86400000
                const elapsed = Date.now() - new Date(cd.created_at).getTime()
                const progress = isMatured ? 100 : Math.min(100, (elapsed / totalMs) * 100)
                const timeLeft = isMatured
                  ? 'Ready!'
                  : (() => {
                      const ms = maturesAt.getTime() - Date.now()
                      const days = Math.floor(ms / 86400000)
                      const hours = Math.floor((ms % 86400000) / 3600000)
                      return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`
                    })()
                return (
                  <div key={cd.id} className={`bank-cd-item ${isMatured ? 'matured' : ''}`}>
                    <div className="bank-cd-item-top">
                      <div className="bank-cd-item-info">
                        <span className="bank-cd-item-term">{cd.term_days}-Day CD</span>
                        <span className="bank-cd-item-principal">{cd.principal.toFixed(0)} {cd.currency}</span>
                      </div>
                      <div className="bank-cd-item-payout">
                        <span className="bank-cd-item-payout-label">Payout</span>
                        <span className="bank-cd-item-payout-value">{payout} <span className="bank-cd-item-bonus">(+{bonus})</span></span>
                      </div>
                      <div className="bank-cd-item-action">
                        {isMatured ? (
                          <button
                            className="btn btn-primary bank-cd-redeem-btn"
                            onClick={() => handleRedeemCD(cd.id)}
                            disabled={redeemingCdId === cd.id}
                          >
                            {redeemingCdId === cd.id ? '...' : 'Redeem'}
                          </button>
                        ) : (
                          <span className="bank-cd-item-time">{timeLeft}</span>
                        )}
                      </div>
                    </div>
                    <div className="bank-cd-progress-track">
                      <div className="bank-cd-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* STOCK MARKET */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">SPITr Stock Market</h2>

          <div className="bank-stock-header">
            <div className="bank-stock-price">
              <span className="bank-stock-symbol">$SPIT</span>
              <span className="bank-stock-current text-glow">{stockPrice.toFixed(2)}</span>
              <span className="bank-stock-unit">spits/share</span>
            </div>
            <div className="bank-chart-period-tabs">
              {[7, 14, 30, 90].map(d => (
                <button
                  key={d}
                  className={`bank-chart-period-btn ${chartDays === d ? 'active' : ''}`}
                  onClick={() => setChartDays(d)}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div className="bank-chart-wrapper">
            <StockChart days={chartDays} />
          </div>

          {/* Portfolio */}
          {currentShares > 0 && (
            <div className="bank-portfolio">
              <div className="bank-portfolio-row">
                <span>Shares</span>
                <span>{currentShares.toFixed(5)}</span>
              </div>
              <div className="bank-portfolio-row">
                <span>Cost Basis</span>
                <span>{costBasis.toFixed(2)} spits</span>
              </div>
              <div className="bank-portfolio-row">
                <span>Current Value</span>
                <span>{currentValue.toFixed(2)} spits</span>
              </div>
              <div className={`bank-portfolio-row bank-portfolio-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>
                <span>P&L</span>
                <span>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent.toFixed(1)}%)</span>
              </div>
            </div>
          )}

          <div className="bank-forms-row">
            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon bank-form-icon-buy">B</div>
                <div>
                  <h3 className="bank-form-title">Buy Shares</h3>
                  <p className="bank-form-sub">From bank spit balance</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Spend (spits)</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="0"
                    value={buyStockAmount}
                    onChange={(e) => setBuyStockAmount(e.target.value)}
                    min="1"
                  />
                  <button
                    className="bank-form-max-btn"
                    onClick={() => setBuyStockAmount(String(Math.floor(spitBank.totalBalance)))}
                  >
                    MAX
                  </button>
                </div>
                {buyStockAmount && Number(buyStockAmount) > 0 && (
                  <div className="bank-form-preview">
                    ≈ {(Number(buyStockAmount) / stockPrice).toFixed(4)} shares
                  </div>
                )}
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleBuyStock}
                  disabled={isBuyingStock || !buyStockAmount || Number(buyStockAmount) <= 0}
                >
                  {isBuyingStock ? 'Buying...' : 'Buy'}
                </button>
              </div>
            </div>

            <div className="bank-form-card">
              <div className="bank-form-header">
                <div className="bank-form-icon bank-form-icon-sell">S</div>
                <div>
                  <h3 className="bank-form-title">Sell Shares</h3>
                  <p className="bank-form-sub">Proceeds to bank (0% rate)</p>
                </div>
              </div>
              <div className="bank-form-body">
                <label className="bank-form-label">Shares</label>
                <div className="bank-form-input-group">
                  <input
                    type="number"
                    className="input bank-form-input"
                    placeholder="0"
                    value={sellSharesAmount}
                    onChange={(e) => setSellSharesAmount(e.target.value)}
                    min="0.00001"
                    step="0.00001"
                  />
                  {currentShares > 0 && (
                    <button
                      className="bank-form-max-btn"
                      onClick={() => setSellSharesAmount(String(currentShares))}
                    >
                      MAX
                    </button>
                  )}
                </div>
                {sellSharesAmount && Number(sellSharesAmount) > 0 && (
                  <div className="bank-form-preview">
                    ≈ {(Number(sellSharesAmount) * stockPrice).toFixed(2)} spits
                  </div>
                )}
                <button
                  className="btn btn-primary bank-form-submit"
                  onClick={handleSellStock}
                  disabled={isSellingStock || !sellSharesAmount || Number(sellSharesAmount) <= 0 || Number(sellSharesAmount) > currentShares}
                >
                  {isSellingStock ? 'Selling...' : 'Sell'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* LOTTERY */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Scratch-Off Lottery</h2>

          <div className="bank-ticket-grid">
            {TICKET_TIERS.map((tier) => {
              const bankBal = tier.currency === 'spit' ? spitBank : goldBank
              const canAfford = bankBal.totalBalance >= tier.cost
              return (
                <div key={tier.type} className={`bank-ticket-card ${canAfford ? '' : 'bank-ticket-card-disabled'}`}>
                  <div className="bank-ticket-emoji">{tier.emoji}</div>
                  <div className="bank-ticket-name">{tier.name}</div>
                  <div className="bank-ticket-cost">
                    {tier.cost} {tier.currency}
                  </div>
                  <button
                    className="btn btn-primary bank-ticket-buy-btn"
                    onClick={() => handleBuyTicket(tier.type)}
                    disabled={buyingTicket === tier.type || !canAfford}
                  >
                    {buyingTicket === tier.type ? '...' : 'Buy'}
                  </button>
                </div>
              )
            })}
          </div>

          {ticketsToScratch.length > 0 && (
            <div className="bank-my-tickets">
              <h3 className="bank-deposits-list-title">My Tickets ({ticketsToScratch.length})</h3>
              <div className="bank-scratch-grid">
                {ticketsToScratch.map((ticket) => (
                  <ScratchCard
                    key={ticket.id}
                    ticket={ticket}
                    onScratched={handleTicketScratched}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
