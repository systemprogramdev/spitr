'use client'

import { useState, useEffect } from 'react'
import { BankDeposit } from '@/types'
import { calculateBankBalance, calculateInterest } from '@/lib/bank'

interface InterestTickerProps {
  deposits: BankDeposit[]
  label?: string
  className?: string
  showBreakdown?: boolean
}

export function InterestTicker({ deposits, label, className, showBreakdown }: InterestTickerProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 100)
    return () => clearInterval(interval)
  }, [])

  const balance = calculateBankBalance(deposits, now)

  return (
    <div className={`interest-ticker ${className || ''}`}>
      {label && <div className="interest-ticker-label">{label}</div>}
      <div className="interest-ticker-value">
        {balance.totalBalance.toFixed(5)}
      </div>
      {showBreakdown && balance.totalInterest > 0 && (
        <div className="interest-ticker-breakdown">
          <span className="interest-ticker-principal">{balance.totalPrincipal.toFixed(2)} principal</span>
          <span className="interest-ticker-earned">+{balance.totalInterest.toFixed(5)} earned</span>
        </div>
      )}
    </div>
  )
}

interface DepositRowTickerProps {
  deposit: BankDeposit
}

export function DepositRowTicker({ deposit }: DepositRowTickerProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 100)
    return () => clearInterval(interval)
  }, [])

  const interest = calculateInterest(deposit.principal, deposit.locked_rate, deposit.deposited_at, now)
  const total = deposit.principal + interest - deposit.withdrawn

  return (
    <div className="deposit-row-ticker">
      <span className="deposit-row-ticker-total">{total.toFixed(5)}</span>
      <span className="deposit-row-ticker-yield">+{interest.toFixed(5)}</span>
    </div>
  )
}
