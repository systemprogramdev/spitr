'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'

const supabase = createClient()

export function ChestClaimModal() {
  const { user } = useAuthStore()
  const { isChestClaimModalOpen, closeChestClaimModal, openChestOpenModal } = useModalStore()
  const [isClaiming, setIsClaiming] = useState(false)

  if (!isChestClaimModalOpen || !user) return null

  const claimChest = async (openImmediately: boolean) => {
    if (isClaiming) return
    setIsClaiming(true)

    // Insert chest
    const { data: chest, error } = await supabase
      .from('user_chests')
      .insert({ user_id: user.id })
      .select('id')
      .single()

    if (error || !chest) {
      console.error('Failed to claim chest:', error)
      setIsClaiming(false)
      return
    }

    // Update last claimed timestamp
    await supabase
      .from('users')
      .update({ last_chest_claimed_at: new Date().toISOString() })
      .eq('id', user.id)

    // Dispatch event for shop to pick up
    window.dispatchEvent(new CustomEvent('chest-claimed'))

    closeChestClaimModal()
    setIsClaiming(false)

    if (openImmediately) {
      openChestOpenModal(chest.id)
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
