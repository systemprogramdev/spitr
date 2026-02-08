'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'

export function ChestClaimModal() {
  const { user } = useAuthStore()
  const { isChestClaimModalOpen, closeChestClaimModal, openChestOpenModal } = useModalStore()
  const [isClaiming, setIsClaiming] = useState(false)

  if (!isChestClaimModalOpen || !user) return null

  const claimChest = async (openImmediately: boolean) => {
    if (isClaiming) return
    setIsClaiming(true)

    try {
      const res = await fetch('/api/claim-daily-chest', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        console.error('Failed to claim chest:', data.error)
        setIsClaiming(false)
        return
      }

      // Dispatch event for shop to pick up
      window.dispatchEvent(new CustomEvent('chest-claimed'))

      closeChestClaimModal()
      setIsClaiming(false)

      if (openImmediately) {
        openChestOpenModal(data.chestId)
      }
    } catch (err) {
      console.error('Claim chest error:', err)
      setIsClaiming(false)
    }
  }

  return (
    <div
      className="pin-modal-overlay"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="pin-modal chest-claim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chest-claim-icon">
          <span className="chest-float-anim">🎁</span>
        </div>
        <div className="pin-modal-header" style={{ justifyContent: 'center' }}>
          <span>Daily Treasure Chest!</span>
        </div>
        <div className="pin-modal-body" style={{ textAlign: 'center' }}>
          <p>You&apos;ve earned a treasure chest! Open it now or save it for later.</p>
          <p style={{ color: 'var(--sys-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Contains random loot: credits, gold, and items!
          </p>
        </div>
        <div className="pin-modal-actions" style={{ justifyContent: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => claimChest(false)}
            disabled={isClaiming}
          >
            Save for Later
          </button>
          <button
            className="btn btn-primary btn-glow"
            onClick={() => claimChest(true)}
            disabled={isClaiming}
          >
            {isClaiming ? 'Claiming...' : 'Claim & Open!'}
          </button>
        </div>
      </div>
    </div>
  )
}
