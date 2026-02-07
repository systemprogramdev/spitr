'use client'

import { useState, useEffect } from 'react'
import { BankDeposit } from '@/types'
import { calculateBankBalance } from '@/lib/bank'

interface InterestTickerProps {
  deposits: BankDeposit[]
  label?: string
  className?: string
}

export function InterestTicker({ deposits, label, className }: InterestTickerProps) {
  const [balance, setBalance] = useState(() => calculateBankBalance(deposits))

  useEffect(() => {
    setBalance(calculateBankBalance(deposits))
    const interval = setInterval(() => {
      setBalance(calculateBankBalance(deposits))
    }, 100)
    return () => clearInterval(interval)
  }, [deposits])

  return (
    <div className={`interest-ticker ${className || ''}`}>
      {label && <div className="interest-ticker-label">{label}</div>}
      <div className="interest-ticker-value">
        {balance.totalBalance.toFixed(5)}
      </div>
    </div>
  )
}
