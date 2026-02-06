'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useInventory } from '@/hooks/useInventory'
import { WEAPONS, ITEM_MAP, GameItem } from '@/lib/items'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'

const WEAPON_SOUNDS: Record<string, 'knife' | 'gunshot' | 'drone'> = {
  knife: 'knife',
  gun: 'gunshot',
  soldier: 'gunshot',
  drone: 'drone',
  nuke: 'drone',
}

interface AttackModalProps {
  targetType: 'user' | 'spit'
  targetId: string
  targetName: string
  onClose: () => void
  onAttackComplete: (result: { newHp: number; destroyed: boolean; damage: number }) => void
}

export function AttackModal({ targetType, targetId, targetName, onClose, onAttackComplete }: AttackModalProps) {
  const { user } = useAuthStore()
  const { getQuantity, refreshInventory } = useInventory()
  const { playSound } = useSound()
  const { awardXP } = useXP()
  const [attacking, setAttacking] = useState(false)
  const [result, setResult] = useState<{ damage: number; newHp: number; destroyed: boolean; blocked?: boolean; blockedBy?: string } | null>(null)
  const [sprayResult, setSprayResult] = useState<boolean | null>(null)

  const handleAttack = async (weapon: GameItem) => {
    if (!user || attacking || !weapon.damage) return

    const qty = getQuantity(weapon.type)
    if (qty < 1) {
      toast.warning(`You don't have any ${weapon.name}s! Buy some from the shop.`)
      return
    }

    setAttacking(true)

    const res = await fetch('/api/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: targetType === 'user' ? targetId : undefined,
        targetSpitId: targetType === 'spit' ? targetId : undefined,
        itemType: weapon.type,
        damage: weapon.damage,
      }),
    })

    const data = await res.json()

    if (data.success) {
      if (data.blocked) {
        playSound('knife') // deflection sound
        setResult({ damage: 0, newHp: data.newHp ?? 0, destroyed: false, blocked: true, blockedBy: data.blockedBy })
        await refreshInventory()
      } else {
        playSound(WEAPON_SOUNDS[weapon.type] || 'knife')
        awardXP('attack', targetId)
        setResult({ damage: data.damage, newHp: data.newHp, destroyed: data.destroyed })
        await refreshInventory()
        onAttackComplete({ newHp: data.newHp, destroyed: data.destroyed, damage: data.damage })
      }
    } else {
      toast.error(data.error || 'Attack failed')
    }

    setAttacking(false)
  }

  const handleSprayPaint = async () => {
    if (!user || attacking) return

    const qty = getQuantity('spray_paint')
    if (qty < 1) {
      toast.warning("You don't have any spray paint! Buy some from the shop.")
      return
    }

    setAttacking(true)

    const res = await fetch('/api/spray-paint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: targetId }),
    })

    const data = await res.json()

    if (data.success) {
      playSound('gold')
      setSprayResult(true)
      await refreshInventory()
    } else {
      toast.error(data.error || 'Spray paint failed')
    }

    setAttacking(false)
  }

  return (
    <div className="pin-modal-overlay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="pin-modal-header" style={{ color: 'var(--sys-danger)' }}>
          <span style={{ fontSize: '1.25rem' }}>⚔️</span>
          <span>Attack {targetName}</span>
        </div>

        {sprayResult ? (
          <div className="pin-modal-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎨</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--sys-success)', fontFamily: 'var(--sys-font-display)' }}>
              TAGGED!
            </div>
            <p style={{ color: 'var(--sys-text-muted)', marginTop: '0.5rem' }}>
              {targetName}&apos;s profile has been spray painted for 24 hours!
            </p>
            <button className="btn btn-outline" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </div>
        ) : result ? (
          <div className="pin-modal-body" style={{ textAlign: 'center' }}>
            {result.blocked ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{result.blockedBy === 'firewall' ? '🛡️' : '🦺'}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--sys-warning)', fontFamily: 'var(--sys-font-display)' }}>
                  BLOCKED by {result.blockedBy === 'firewall' ? 'Firewall' : 'Kevlar'}!
                </div>
                <p style={{ color: 'var(--sys-text-muted)', marginTop: '0.5rem' }}>
                  Your weapon was consumed but the attack was deflected.
                </p>
              </>
            ) : (
              <>
                <div className="attack-damage-display">-{result.damage}</div>
                <p style={{ color: 'var(--sys-text-muted)', marginTop: '0.5rem' }}>
                  {result.destroyed
                    ? `${targetName} has been DESTROYED!`
                    : `${targetName} now has ${result.newHp} HP remaining.`}
                </p>
              </>
            )}
            <button className="btn btn-outline" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </div>
        ) : (
          <div className="pin-modal-body">
            <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.75rem' }}>Choose a weapon:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {WEAPONS.map((weapon) => {
                const qty = getQuantity(weapon.type)
                return (
                  <button
                    key={weapon.type}
                    className="shop-weapon-select"
                    onClick={() => handleAttack(weapon)}
                    disabled={attacking || qty < 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: qty < 1 ? 'var(--sys-surface)' : 'rgba(255,68,68,0.05)',
                      border: `1px solid ${qty < 1 ? 'var(--sys-border)' : 'var(--sys-danger)'}`,
                      borderRadius: '8px',
                      cursor: qty < 1 ? 'not-allowed' : 'pointer',
                      opacity: qty < 1 ? 0.5 : 1,
                      color: 'var(--sys-text)',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{weapon.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{weapon.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--sys-danger)' }}>{weapon.damage} DMG</div>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--sys-text-muted)' }}>
                      x{qty}
                    </span>
                  </button>
                )
              })}
            </div>
            {targetType === 'user' && (
              <>
                <div style={{ borderTop: '1px solid var(--sys-border)', margin: '0.75rem 0', paddingTop: '0.75rem' }}>
                  <p style={{ color: 'var(--sys-text-muted)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Utility:</p>
                  <button
                    className="shop-weapon-select"
                    onClick={handleSprayPaint}
                    disabled={attacking || getQuantity('spray_paint') < 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: getQuantity('spray_paint') < 1 ? 'var(--sys-surface)' : 'rgba(34,197,94,0.05)',
                      border: `1px solid ${getQuantity('spray_paint') < 1 ? 'var(--sys-border)' : 'var(--sys-success)'}`,
                      borderRadius: '8px',
                      cursor: getQuantity('spray_paint') < 1 ? 'not-allowed' : 'pointer',
                      opacity: getQuantity('spray_paint') < 1 ? 0.5 : 1,
                      color: 'var(--sys-text)',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>🎨</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Spray Paint</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--sys-success)' }}>TAG for 24h</div>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--sys-text-muted)' }}>
                      x{getQuantity('spray_paint')}
                    </span>
                  </button>
                </div>
              </>
            )}
            {attacking && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <div className="loading-spinner"></div>
              </div>
            )}
          </div>
        )}

        <div className="pin-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
