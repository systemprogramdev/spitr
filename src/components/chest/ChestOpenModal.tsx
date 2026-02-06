'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useModalStore } from '@/stores/modalStore'
import { LootReward, RARITY_COLORS } from '@/lib/items'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'

type Phase = 'closed' | 'shaking' | 'opening' | 'revealed'

export function ChestOpenModal() {
  const { user } = useAuthStore()
  const { isChestOpenModalOpen, openingChestId, closeChestOpenModal } = useModalStore()
  const { playSound } = useSound()
  const { awardXP } = useXP()
  const [phase, setPhase] = useState<Phase>('closed')
  const [loot, setLoot] = useState<LootReward[]>([])

  if (!isChestOpenModalOpen || !openingChestId || !user) return null

  const handleOpen = async () => {
    setPhase('shaking')

    // Shake for 1s
    await new Promise((r) => setTimeout(r, 1000))
    setPhase('opening')

    // Open animation for 0.5s
    await new Promise((r) => setTimeout(r, 500))

    // Call API to open chest
    const res = await fetch('/api/open-chest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, chestId: openingChestId }),
    })

    const data = await res.json()

    if (data.success && data.loot) {
      playSound('chest')
      awardXP('chest_open', openingChestId)
      setLoot(data.loot)
      setPhase('revealed')
      window.dispatchEvent(new CustomEvent('chest-opened'))
    } else {
      toast.error(data.error || 'Failed to open chest')
      handleClose()
    }
  }

  const handleClose = () => {
    setPhase('closed')
    setLoot([])
    closeChestOpenModal()
  }

  return (
    <div
      className="pin-modal-overlay"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="pin-modal chest-open-modal" onClick={(e) => e.stopPropagation()}>
        {phase === 'closed' && (
          <>
            <div className="chest-open-icon">
              <span style={{ fontSize: '4rem' }}>🎁</span>
            </div>
            <div className="pin-modal-header" style={{ justifyContent: 'center' }}>
              <span>Open Treasure Chest</span>
            </div>
            <div className="pin-modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-glow" onClick={handleOpen}>
                Open Chest
              </button>
            </div>
          </>
        )}

        {phase === 'shaking' && (
          <div className="chest-open-icon">
            <span className="chest-shake-anim" style={{ fontSize: '4rem' }}>🎁</span>
          </div>
        )}

        {phase === 'opening' && (
          <div className="chest-open-icon">
            <span className="chest-open-anim" style={{ fontSize: '4rem' }}>🎁</span>
          </div>
        )}

        {phase === 'revealed' && (
          <>
            <div className="pin-modal-header" style={{ justifyContent: 'center' }}>
              <span>Loot Received!</span>
            </div>
            <div className="chest-loot-grid">
              {loot.map((item, i) => (
                <div
                  key={i}
                  className={`chest-loot-card chest-loot-${item.rarity}`}
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    borderColor: RARITY_COLORS[item.rarity],
                  }}
                >
                  <span className="chest-loot-emoji">{item.emoji}</span>
                  <span className="chest-loot-label">{item.label}</span>
                  <span
                    className="chest-loot-rarity"
                    style={{ color: RARITY_COLORS[item.rarity] }}
                  >
                    {item.rarity}
                  </span>
                </div>
              ))}
            </div>
            <div className="pin-modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-glow" onClick={handleClose}>
                Claim
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
