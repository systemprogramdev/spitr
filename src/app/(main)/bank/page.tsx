'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCredits } from '@/hooks/useCredits'
import { useGold } from '@/hooks/useGold'
import { useBank } from '@/hooks/useBank'
import { useSound } from '@/hooks/useSound'
import { toast } from '@/stores/toastStore'
import {
  getCurrentDailyRate,
  formatRate,
  calculateBankBalance,
  getStockPrice,
  TICKET_TIERS,
  TICKET_MAP,
  BankBalance,
} from '@/lib/bank'
import { InterestTicker } from '@/components/bank/InterestTicker'
import { StockChart } from '@/components/bank/StockChart'
import { ScratchCard } from '@/components/bank/ScratchCard'
import { LotteryTicket } from '@/types'

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
  const { balance: walletSpits, refreshBalance: refreshCredits } = useCredits()
  const { balance: walletGold, refreshBalance: refreshGold } = useGold()
  const {
    spitDeposits,
    goldDeposits,
    stockHolding,
    unscratchedTickets,
    loaded,
    refresh: refreshBank,
    getSpitBankBalance,
    getGoldBankBalance,
  } = useBank()
  const { playSound } = useSound()

  // Current rate (updates every second)
  const [currentRate, setCurrentRate] = useState(getCurrentDailyRate())
  const [stockPrice, setStockPrice] = useState(getStockPrice())

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

  // Scratched tickets (recently revealed)
  const [scratchedIds, setScratchedIds] = useState<Set<string>>(new Set())

  // Ticking balances
  const [spitBank, setSpitBank] = useState<BankBalance>({ totalPrincipal: 0, totalInterest: 0, totalBalance: 0, totalWithdrawn: 0 })
  const [goldBank, setGoldBank] = useState<BankBalance>({ totalPrincipal: 0, totalInterest: 0, totalBalance: 0, totalWithdrawn: 0 })

  // Update rate + stock price every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRate(getCurrentDailyRate())
      setStockPrice(getStockPrice())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Tick bank balances every 100ms
  useEffect(() => {
    const tick = () => {
      setSpitBank(getSpitBankBalance())
      setGoldBank(getGoldBankBalance())
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [spitDeposits, goldDeposits])

  // Deposit
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

  // Withdraw
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

  // Buy stock
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

  // Sell stock
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

  // Buy ticket
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
        playSound('chest')
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
    setScratchedIds(prev => new Set(prev).add(ticketId))
    refreshBank()
  }

  // Stock P&L
  const currentShares = stockHolding?.shares || 0
  const costBasis = stockHolding?.total_cost_basis || 0
  const currentValue = currentShares * stockPrice
  const pnl = currentValue - costBasis
  const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0

  // Active deposits for current tab
  const activeDeposits = depositTab === 'spit' ? spitDeposits : goldDeposits
  const bankBalance = depositTab === 'spit' ? spitBank : goldBank

  // Tickets to show (unscratched and not yet revealed in this session)
  const ticketsToScratch = unscratchedTickets.filter(t => !scratchedIds.has(t.id))

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
          <h2 className="bank-section-heading">Balance Overview</h2>
          <div className="bank-overview-grid">
            <div className="bank-overview-card">
              <div className="bank-overview-label">Wallet (Spits)</div>
              <div className="bank-overview-value">{walletSpits.toLocaleString()}</div>
            </div>
            <div className="bank-overview-card">
              <div className="bank-overview-label">Wallet (Gold)</div>
              <div className="bank-overview-value">{walletGold.toLocaleString()}</div>
            </div>
            <div className="bank-overview-card bank-overview-card-highlight">
              <div className="bank-overview-label">Bank (Spits)</div>
              <div className="bank-overview-value bank-ticker-value">
                {spitBank.totalBalance.toFixed(5)}
              </div>
            </div>
            <div className="bank-overview-card bank-overview-card-highlight">
              <div className="bank-overview-label">Bank (Gold)</div>
              <div className="bank-overview-value bank-ticker-value">
                {goldBank.totalBalance.toFixed(5)}
              </div>
            </div>
          </div>
          <div className="bank-rate-display">
            <span className="bank-rate-label">Current Interest Rate</span>
            <span className="bank-rate-value text-glow">{formatRate(currentRate)}</span>
            <span className="bank-rate-sub">per year (locked at deposit time)</span>
          </div>
        </section>

        {/* ============================================ */}
        {/* DEPOSIT / WITHDRAW */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Deposits & Withdrawals</h2>

          {/* Currency tabs */}
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
            {/* Deposit form */}
            <div className="bank-form-card">
              <h3 className="bank-form-title">Deposit {depositTab}</h3>
              <p className="bank-form-sub">Lock rate: {formatRate(currentRate)}</p>
              <div className="bank-form-input-row">
                <input
                  type="number"
                  className="sys-input"
                  placeholder="Amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="1"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleDeposit}
                  disabled={isDepositing || !depositAmount}
                >
                  {isDepositing ? 'Depositing...' : 'Deposit'}
                </button>
              </div>
              <div className="bank-form-balance">
                Wallet: {depositTab === 'spit' ? walletSpits.toLocaleString() : walletGold.toLocaleString()} {depositTab}
              </div>
            </div>

            {/* Withdraw form */}
            <div className="bank-form-card">
              <h3 className="bank-form-title">Withdraw {depositTab}</h3>
              <p className="bank-form-sub">Floored to integer</p>
              <div className="bank-form-input-row">
                <input
                  type="number"
                  className="sys-input"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="1"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount}
                >
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                </button>
              </div>
              <div className="bank-form-balance">
                Bank: {bankBalance.totalBalance.toFixed(2)} {depositTab}
              </div>
            </div>
          </div>

          {/* Active deposits list */}
          {activeDeposits.length > 0 && (
            <div className="bank-deposits-list">
              <h3 className="bank-deposits-list-title">Active Deposits ({depositTab})</h3>
              {activeDeposits.map((d) => {
                const interest = calculateBankBalance([d])
                const remaining = d.principal + interest.totalInterest - d.withdrawn
                return (
                  <div key={d.id} className="bank-deposit-row">
                    <div className="bank-deposit-info">
                      <span className="bank-deposit-principal">{d.principal.toFixed(2)}</span>
                      <span className="bank-deposit-rate">@ {formatRate(d.locked_rate)}</span>
                      <span className="bank-deposit-time">{timeAgo(d.deposited_at)}</span>
                    </div>
                    <div className="bank-deposit-interest">
                      +{interest.totalInterest.toFixed(5)} earned
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
            {/* Buy stock */}
            <div className="bank-form-card">
              <h3 className="bank-form-title">Buy Shares</h3>
              <p className="bank-form-sub">Uses bank spit balance</p>
              <div className="bank-form-input-row">
                <input
                  type="number"
                  className="sys-input"
                  placeholder="Spit amount"
                  value={buyStockAmount}
                  onChange={(e) => setBuyStockAmount(e.target.value)}
                  min="1"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleBuyStock}
                  disabled={isBuyingStock || !buyStockAmount}
                >
                  {isBuyingStock ? 'Buying...' : 'Buy'}
                </button>
              </div>
              {buyStockAmount && Number(buyStockAmount) > 0 && (
                <div className="bank-form-preview">
                  ~{(Number(buyStockAmount) / stockPrice).toFixed(2)} shares
                </div>
              )}
            </div>

            {/* Sell stock */}
            <div className="bank-form-card">
              <h3 className="bank-form-title">Sell Shares</h3>
              <p className="bank-form-sub">Proceeds go to bank (0% rate)</p>
              <div className="bank-form-input-row">
                <input
                  type="number"
                  className="sys-input"
                  placeholder="Shares"
                  value={sellSharesAmount}
                  onChange={(e) => setSellSharesAmount(e.target.value)}
                  min="0.00001"
                  step="0.00001"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSellStock}
                  disabled={isSellingStock || !sellSharesAmount}
                >
                  {isSellingStock ? 'Selling...' : 'Sell'}
                </button>
              </div>
              {sellSharesAmount && Number(sellSharesAmount) > 0 && (
                <div className="bank-form-preview">
                  ~{(Number(sellSharesAmount) * stockPrice).toFixed(2)} spits
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* LOTTERY */}
        {/* ============================================ */}
        <section className="bank-section">
          <h2 className="bank-section-heading">Scratch-Off Lottery</h2>
          <p className="bank-section-sub">Buy tickets with your bank balance. Scratch to reveal!</p>

          <div className="bank-ticket-grid">
            {TICKET_TIERS.map((tier) => {
              const bankBal = tier.currency === 'spit' ? spitBank : goldBank
              const canAfford = bankBal.totalBalance >= tier.cost
              return (
                <div key={tier.type} className="bank-ticket-card">
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
                    {buyingTicket === tier.type ? 'Buying...' : canAfford ? 'Buy' : 'Insufficient'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Unscratched tickets */}
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
