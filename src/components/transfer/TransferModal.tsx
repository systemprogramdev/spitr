'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCredits } from '@/hooks/useCredits'

interface TransferModalProps {
  recipientId: string
  recipientHandle: string
  recipientName: string
  onClose: () => void
  onTransferComplete?: (newBalance: number) => void
}

const DAILY_LIMIT = 100
const HP_PENALTY_PER_SPIT = 100

export function TransferModal({
  recipientId,
  recipientHandle,
  recipientName,
  onClose,
  onTransferComplete,
}: TransferModalProps) {
  const { user } = useAuthStore()
  const { balance, refreshBalance } = useCredits()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'warning' | 'sending' | 'result'>('input')
  const [result, setResult] = useState<{
    success: boolean
    newBalance?: number
    hpPenalty?: number
    newHp?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limits, setLimits] = useState<{ sentToday: number; receivedToday: number } | null>(null)
  const [loadingLimits, setLoadingLimits] = useState(true)

  const parsedAmount = parseInt(amount, 10)
  const isValid = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= balance

  // Fetch daily limits on mount
  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const res = await fetch('/api/transfer-limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId }),
        })
        const data = await res.json()
        setLimits({ sentToday: data.sentToday, receivedToday: data.receivedToday })
      } catch {
        setLimits({ sentToday: 0, receivedToday: 0 })
      }
      setLoadingLimits(false)
    }
    fetchLimits()
  }, [recipientId])

  // Calculate overage
  const sendOverage = limits && isValid ? Math.max(0, (limits.sentToday + parsedAmount) - DAILY_LIMIT) : 0
  const receiveOverage = limits && isValid ? Math.max(0, (limits.receivedToday + parsedAmount) - DAILY_LIMIT) : 0
  const overage = Math.max(sendOverage, receiveOverage)
  const hpPenalty = overage * HP_PENALTY_PER_SPIT
  const isOverLimit = overage > 0

  const handleSendClick = () => {
    if (!user || !isValid) return
    if (isOverLimit) {
      setStep('warning')
    } else {
      executeTransfer()
    }
  }

  const executeTransfer = async () => {
    if (!user || !isValid) return
    setStep('sending')
    setError(null)

    try {
      const res = await fetch('/api/transfer-spits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, amount: parsedAmount }),
      })

      const data = await res.json()

      if (data.success) {
        setResult({
          success: true,
          newBalance: data.newBalance,
          hpPenalty: data.hpPenalty || 0,
          newHp: data.newHp,
        })
        setStep('result')
        await refreshBalance()
        onTransferComplete?.(data.newBalance)
      } else {
        setError(data.error || 'Transfer failed')
        setStep('input')
      }
    } catch {
      setError('Network error')
      setStep('input')
    }
  }

  return (
    <div className="pin-modal-overlay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="pin-modal-header">
          <span style={{ fontSize: '1.25rem' }}>&#x1F4B8;</span>
          <span>Send Spits to @{recipientHandle}</span>
        </div>

        {/* RESULT STEP */}
        {step === 'result' && result ? (
          <div className="pin-modal-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>&#x2705;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--sys-accent)', marginBottom: '0.5rem' }}>
              Sent!
            </div>
            <p style={{ color: 'var(--sys-text-muted)' }}>
              {parsedAmount.toLocaleString()} spits sent to {recipientName}
            </p>
            <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              New balance: {result.newBalance?.toLocaleString()} spits
            </p>
            {result.hpPenalty !== undefined && result.hpPenalty > 0 && (
              <p style={{ color: 'var(--sys-danger)', fontSize: '0.9rem', marginTop: '0.75rem', fontWeight: 600 }}>
                &#x26A0;&#xFE0F; Daily limit exceeded! You lost {result.hpPenalty.toLocaleString()} HP
                {result.newHp !== undefined && result.newHp >= 0 && ` (HP now: ${result.newHp.toLocaleString()})`}
              </p>
            )}
          </div>

        /* WARNING STEP */
        ) : step === 'warning' ? (
          <div className="pin-modal-body">
            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '2.5rem' }}>&#x2620;&#xFE0F;</span>
            </div>
            <p style={{ color: 'var(--sys-danger)', fontWeight: 700, textAlign: 'center', marginBottom: '0.75rem', fontSize: '1.05rem' }}>
              Daily Transfer Limit Exceeded
            </p>
            <div style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid var(--sys-danger)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
              {sendOverage > 0 && (
                <p style={{ color: 'var(--sys-text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  You have sent <strong>{limits?.sentToday}</strong>/100 spits today.
                  Sending {parsedAmount} more puts you <strong>{sendOverage} over</strong> the daily send limit.
                </p>
              )}
              {receiveOverage > 0 && (
                <p style={{ color: 'var(--sys-text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  @{recipientHandle} has received <strong>{limits?.receivedToday}</strong>/100 spits today.
                  This puts them <strong>{receiveOverage} over</strong> the daily receive limit.
                </p>
              )}
              <p style={{ color: 'var(--sys-danger)', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.6rem', textAlign: 'center' }}>
                HP Penalty: -{hpPenalty.toLocaleString()} HP
              </p>
            </div>
            <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              The transfer will go through, but you will lose <strong>{HP_PENALTY_PER_SPIT} HP for every spit</strong> over the limit.
              This penalty is applied to your profile HP.
            </p>
          </div>

        /* SENDING STEP */
        ) : step === 'sending' ? (
          <div className="pin-modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <p style={{ color: 'var(--sys-text-muted)' }}>Sending...</p>
          </div>

        /* INPUT STEP */
        ) : (
          <div className="pin-modal-body">
            {loadingLimits ? (
              <p style={{ color: 'var(--sys-text-muted)', textAlign: 'center' }}>Checking limits...</p>
            ) : (
              <>
                <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.5rem' }}>
                  Your balance: <strong style={{ color: 'var(--sys-text)' }}>{balance.toLocaleString()}</strong> spits
                </p>
                {limits && (
                  <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    Sent today: <strong>{limits.sentToday}</strong>/100
                    {' | '}
                    They received today: <strong>{limits.receivedToday}</strong>/100
                  </p>
                )}
                <input
                  type="number"
                  className="input"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null) }}
                  placeholder="Amount to send"
                  min={1}
                  max={balance}
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                />
                {error && (
                  <p style={{ color: 'var(--sys-danger)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{error}</p>
                )}
                {isValid && !isOverLimit && (
                  <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Remaining after transfer: {(balance - parsedAmount).toLocaleString()} spits
                  </p>
                )}
                {isValid && isOverLimit && (
                  <p style={{ color: 'var(--sys-warning, #f59e0b)', fontSize: '0.85rem', marginTop: '0.25rem', fontWeight: 600 }}>
                    &#x26A0;&#xFE0F; Exceeds daily limit! Will cost you {hpPenalty.toLocaleString()} HP
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={step === 'warning' ? () => setStep('input') : onClose}>
            {step === 'result' ? 'Done' : step === 'warning' ? 'Go Back' : 'Cancel'}
          </button>
          {step === 'input' && (
            <button
              className={`btn ${isOverLimit ? '' : 'btn-primary btn-glow'}`}
              style={isOverLimit ? { background: 'var(--sys-warning, #f59e0b)', color: '#000' } : undefined}
              onClick={handleSendClick}
              disabled={!isValid || loadingLimits}
            >
              {`Send${isValid ? ` ${parsedAmount.toLocaleString()}` : ''} Spits`}
            </button>
          )}
          {step === 'warning' && (
            <button
              className="btn"
              style={{ background: 'var(--sys-danger)', color: 'var(--sys-bg)' }}
              onClick={executeTransfer}
            >
              Send Anyway (-{hpPenalty.toLocaleString()} HP)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
