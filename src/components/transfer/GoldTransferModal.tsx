'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useGold } from '@/hooks/useGold'
import { useSound } from '@/hooks/useSound'

interface GoldTransferModalProps {
  recipientId: string
  recipientHandle: string
  recipientName: string
  onClose: () => void
}

export function GoldTransferModal({
  recipientId,
  recipientHandle,
  recipientName,
  onClose,
}: GoldTransferModalProps) {
  const { user } = useAuthStore()
  const { balance, refreshBalance } = useGold()
  const { playSound } = useSound()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'sending' | 'result'>('input')
  const [result, setResult] = useState<{ newBalance?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = parseInt(amount, 10)
  const isValid = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= balance

  const executeTransfer = async () => {
    if (!user || !isValid) return
    setStep('sending')
    setError(null)

    try {
      const res = await fetch('/api/transfer-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, amount: parsedAmount }),
      })

      const data = await res.json()

      if (data.success) {
        playSound('gold')
        setResult({ newBalance: data.newBalance })
        setStep('result')
        await refreshBalance()
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
          <span style={{ fontSize: '1.25rem' }}>&#x1FA99;</span>
          <span>Send Gold to @{recipientHandle}</span>
        </div>

        {/* RESULT STEP */}
        {step === 'result' && result ? (
          <div className="pin-modal-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>&#x2705;</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f0b232', marginBottom: '0.5rem' }}>
              Sent!
            </div>
            <p style={{ color: 'var(--sys-text-muted)' }}>
              {parsedAmount.toLocaleString()} gold sent to {recipientName}
            </p>
            <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              New balance: {result.newBalance?.toLocaleString()} gold
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
            <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.75rem' }}>
              Your gold: <strong style={{ color: '#f0b232' }}>{balance.toLocaleString()}</strong>
            </p>
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
            {isValid && (
              <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Remaining after transfer: {(balance - parsedAmount).toLocaleString()} gold
              </p>
            )}
          </div>
        )}

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            {step === 'result' ? 'Done' : 'Cancel'}
          </button>
          {step === 'input' && (
            <button
              className="btn"
              style={{ background: '#f0b232', color: '#000' }}
              onClick={executeTransfer}
              disabled={!isValid}
            >
              {`Send${isValid ? ` ${parsedAmount.toLocaleString()}` : ''} Gold`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
