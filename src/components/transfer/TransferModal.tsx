'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCredits } from '@/hooks/useCredits'

interface TransferModalProps {
  recipientId: string
  recipientHandle: string
  recipientName: string
  onClose: () => void
  onTransferComplete?: (newBalance: number) => void
}

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
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; newBalance?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsedAmount = parseInt(amount, 10)
  const isValid = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= balance

  const handleTransfer = async () => {
    if (!user || sending || !isValid) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/transfer-spits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, amount: parsedAmount }),
      })

      const data = await res.json()

      if (data.success) {
        setResult({ success: true, newBalance: data.newBalance })
        await refreshBalance()
        onTransferComplete?.(data.newBalance)
      } else {
        setError(data.error || 'Transfer failed')
      }
    } catch {
      setError('Network error')
    }

    setSending(false)
  }

  return (
    <div className="pin-modal-overlay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="pin-modal-header">
          <span style={{ fontSize: '1.25rem' }}>&#x1F4B8;</span>
          <span>Send Spits to @{recipientHandle}</span>
        </div>

        {result ? (
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
          </div>
        ) : (
          <div className="pin-modal-body">
            <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.75rem' }}>
              Your balance: <strong style={{ color: 'var(--sys-text)' }}>{balance.toLocaleString()}</strong> spits
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
                Remaining after transfer: {(balance - parsedAmount).toLocaleString()} spits
              </p>
            )}
          </div>
        )}

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              className="btn btn-primary btn-glow"
              onClick={handleTransfer}
              disabled={sending || !isValid}
            >
              {sending ? 'Sending...' : `Send${isValid ? ` ${parsedAmount.toLocaleString()}` : ''} Spits`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
