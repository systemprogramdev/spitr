'use client'

import { useEffect } from 'react'
import { useModalStore } from '@/stores/modalStore'
import { playSoundDirect } from '@/hooks/useSound'

export function PaycheckModal() {
  const { isPaycheckModalOpen, closePaycheckModal } = useModalStore()

  useEffect(() => {
    if (isPaycheckModalOpen) {
      playSoundDirect('check')
    }
  }, [isPaycheckModalOpen])

  if (!isPaycheckModalOpen) return null

  return (
    <div
      className="pin-modal-overlay"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="pin-modal paycheck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paycheck-image-wrapper">
          <img
            src="/images/spitcheck.png"
            alt="Spitverse Paycheck"
            className="paycheck-image"
          />
        </div>
        <div className="pin-modal-header" style={{ justifyContent: 'center' }}>
          <span>Paycheck Deposited!</span>
        </div>
        <div className="pin-modal-body" style={{ textAlign: 'center' }}>
          <p>Your weekly paycheck of <strong style={{ color: 'var(--sys-primary)' }}>1,000 spits</strong> has been deposited directly to your bank.</p>
          <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            It&apos;s already earning interest!
          </p>
        </div>
        <div className="pin-modal-actions" style={{ justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-glow"
            onClick={closePaycheckModal}
          >
            Collect
          </button>
        </div>
      </div>
    </div>
  )
}
