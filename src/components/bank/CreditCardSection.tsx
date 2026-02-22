'use client'

import { useState } from 'react'
import { useCreditCard } from '@/hooks/useCreditCard'
import { useGold } from '@/hooks/useGold'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'
import {
  getScoreTier,
  getScorePercent,
  getAvailableCredit,
  getUtilizationPercent,
  getBillingCycleDaysRemaining,
  canRequestIncrease,
  daysUntilIncrease,
  CC_TXN_LABELS,
} from '@/lib/creditCard'

export function CreditCardSection() {
  const { user } = useAuthStore()
  const { card, transactions, loaded, refresh } = useCreditCard()
  const { balance: goldBalance, refreshBalance: refreshGold } = useGold()
  const { awardXP } = useXP()

  const [isActivating, setIsActivating] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [showTxns, setShowTxns] = useState(false)

  if (!loaded || !user) return null

  // Card offer / activation state
  if (!card) {
    return (
      <section className="bank-section">
        <div className="cc-offer">
          <img src="/images/SPITrCC.png" alt="SPITr Credit Card" className="cc-card-image cc-card-dim" />
          <div className="cc-offer-text">
            <div className="cc-offer-title">SPITr Credit Card</div>
            <div className="cc-offer-desc">
              Get a 1,000 gold credit line. Use it in the shop, bank, or withdraw cash at the ATM.
              Build your credit score to unlock higher limits.
            </div>
          </div>
          <div className="cc-offer-actions">
            <button
              className="btn btn-primary btn-glow"
              disabled={isActivating}
              onClick={async () => {
                setIsActivating(true)
                try {
                  const res = await fetch('/api/credit-card/activate', { method: 'POST' })
                  const data = await res.json()
                  if (data.success) {
                    toast.success('Credit card activated! 1,000g credit line.')
                    awardXP('cc_activate')
                    await refresh()
                  } else {
                    toast.error(data.error || 'Activation failed')
                  }
                } catch {
                  toast.error('Network error')
                }
                setIsActivating(false)
              }}
            >
              {isActivating ? '...' : 'ACCEPT OFFER'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const tier = getScoreTier(card.credit_score)
  const scorePercent = getScorePercent(card.credit_score)
  const available = getAvailableCredit(card.credit_limit, card.current_balance)
  const utilization = getUtilizationPercent(card.credit_limit, card.current_balance)
  const cycleDays = getBillingCycleDaysRemaining(card.billing_cycle_start)
  const cycleHours = Math.floor((cycleDays % 1) * 24)
  const canIncrease = canRequestIncrease(card.last_limit_increase_at)
  const increaseDays = daysUntilIncrease(card.last_limit_increase_at)
  const tierCap = tier.limitCap

  const handlePay = async () => {
    const amt = parseInt(payAmount, 10)
    if (!amt || amt <= 0) return
    setIsPaying(true)
    try {
      const res = await fetch('/api/credit-card/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Paid ${data.paid}g — Score +${data.scoreBonus}`)
        awardXP('cc_payment')
        setPayAmount('')
        await Promise.all([refresh(), refreshGold()])
      } else {
        toast.error(data.error || 'Payment failed')
      }
    } catch {
      toast.error('Network error')
    }
    setIsPaying(false)
  }

  const handleAdvance = async () => {
    const amt = parseInt(advanceAmount, 10)
    if (!amt || amt < 10) return
    setIsAdvancing(true)
    try {
      const res = await fetch('/api/credit-card/cash-advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.goldReceived}g deposited to wallet`)
        awardXP('cc_cash_advance')
        setAdvanceAmount('')
        await Promise.all([refresh(), refreshGold()])
      } else {
        toast.error(data.error || 'Advance failed')
      }
    } catch {
      toast.error('Network error')
    }
    setIsAdvancing(false)
  }

  const handleRequestIncrease = async () => {
    setIsRequesting(true)
    try {
      const res = await fetch('/api/credit-card/request-increase', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Limit increased! ${data.oldLimit.toLocaleString()}g → ${data.newLimit.toLocaleString()}g`)
        await refresh()
      } else {
        toast.error(data.error || 'Increase denied')
      }
    } catch {
      toast.error('Network error')
    }
    setIsRequesting(false)
  }

  return (
    <section className="bank-section">
      <h2 className="bank-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>💳</span> SPITr Credit Card
      </h2>

      {/* Card visual + score */}
      <div className="cc-card-area">
        <div className="cc-card-wrap">
          <img src="/images/SPITrCC.png" alt="SPITr Credit Card" className="cc-card-image" />
          <div className="cc-card-overlay">
            <span className="cc-card-handle">{user.handle}</span>
          </div>
        </div>

        <div className="cc-info-panel">
          {/* Credit Score */}
          <div className="cc-score-section">
            <div className="cc-score-header">
              <span className="cc-score-label">Credit Score</span>
              <span className="cc-score-value" style={{ color: tier.color }}>{card.credit_score}</span>
            </div>
            <div className="cc-score-bar">
              <div className="cc-score-fill" style={{ width: `${scorePercent}%`, background: tier.color }} />
            </div>
            <div className="cc-score-tier" style={{ color: tier.color }}>{tier.name}</div>
          </div>

          {/* Balance */}
          <div className="cc-balance-row">
            <div>
              <div className="cc-balance-label">Owed</div>
              <div className="cc-balance-value">{card.current_balance.toLocaleString()}g</div>
            </div>
            <div>
              <div className="cc-balance-label">Available</div>
              <div className="cc-balance-value" style={{ color: 'var(--spit-green)' }}>{available.toLocaleString()}g</div>
            </div>
            <div>
              <div className="cc-balance-label">Limit</div>
              <div className="cc-balance-value">{card.credit_limit.toLocaleString()}g</div>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="cc-util-bar">
            <div
              className="cc-util-fill"
              style={{
                width: `${utilization}%`,
                background: utilization > 80 ? '#ef4444' : utilization > 50 ? '#f59e0b' : 'var(--spit-green)',
              }}
            />
          </div>

          {/* Billing cycle + limit increase */}
          <div className="cc-meta-row">
            <span className="cc-meta-item">
              Bill due: {Math.floor(cycleDays)}d {cycleHours}h
            </span>
            {card.current_balance > 0 && (
              <span className="cc-meta-item" style={{ color: '#f59e0b' }}>
                5% interest at cycle end
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="cc-actions">
        {/* Payment */}
        <div className="cc-action-card">
          <div className="cc-action-title">Pay Balance</div>
          <div className="cc-action-sub">Gold wallet: {goldBalance.toLocaleString()}g</div>
          <div className="cc-action-form">
            <input
              type="number"
              className="input"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount"
              min={1}
              max={Math.min(goldBalance, card.current_balance)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.7rem', padding: '0.4rem' }}
              onClick={() => setPayAmount(String(Math.min(goldBalance, card.current_balance)))}
            >
              MAX
            </button>
            <button
              className="btn btn-success"
              onClick={handlePay}
              disabled={isPaying || !payAmount || parseInt(payAmount) <= 0 || card.current_balance <= 0}
            >
              {isPaying ? '...' : 'PAY'}
            </button>
          </div>
        </div>

        {/* ATM */}
        <div className="cc-action-card">
          <div className="cc-action-title">ATM Cash Advance</div>
          <div className="cc-action-sub">Available: {available.toLocaleString()}g</div>
          <div className="cc-action-form">
            <input
              type="number"
              className="input"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              placeholder="Min 10"
              min={10}
              max={available}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.7rem', padding: '0.4rem' }}
              onClick={() => setAdvanceAmount(String(available))}
            >
              MAX
            </button>
            <button
              className="btn btn-warning"
              onClick={handleAdvance}
              disabled={isAdvancing || !advanceAmount || parseInt(advanceAmount) < 10 || available < 10}
            >
              {isAdvancing ? '...' : 'WITHDRAW'}
            </button>
          </div>
        </div>
      </div>

      {/* Request limit increase */}
      <div className="cc-increase-row">
        <button
          className="btn btn-primary"
          onClick={handleRequestIncrease}
          disabled={isRequesting || !canIncrease || card.credit_limit >= tierCap}
        >
          {isRequesting
            ? '...'
            : !canIncrease
              ? `Increase in ${Math.ceil(increaseDays)}d`
              : card.credit_limit >= tierCap
                ? 'At tier limit'
                : 'Request Limit Increase'}
        </button>
        {card.credit_limit < tierCap && (
          <span className="cc-increase-hint">
            {card.credit_limit.toLocaleString()}g → {Math.min(tierCap, card.credit_limit * 2).toLocaleString()}g
          </span>
        )}
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="cc-txn-section">
          <button
            className="cc-txn-toggle"
            onClick={() => setShowTxns(!showTxns)}
          >
            Recent Transactions {showTxns ? '▲' : '▼'}
          </button>
          {showTxns && (
            <div className="cc-txn-list">
              {transactions.map((txn) => (
                <div key={txn.id} className="cc-txn-row">
                  <span className="cc-txn-type">{CC_TXN_LABELS[txn.type] || txn.type}</span>
                  <span className="cc-txn-desc">{txn.description}</span>
                  <span
                    className="cc-txn-amount"
                    style={{ color: txn.amount < 0 ? 'var(--spit-green)' : 'var(--sys-error)' }}
                  >
                    {txn.amount < 0 ? '' : '+'}{txn.amount}g
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
