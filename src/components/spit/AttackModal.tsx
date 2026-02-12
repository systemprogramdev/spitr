'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useInventory } from '@/hooks/useInventory'
import { WEAPONS, GameItem } from '@/lib/items'
import { useSound } from '@/hooks/useSound'
import { useXP } from '@/hooks/useXP'
import { toast } from '@/stores/toastStore'

const WEAPON_SOUNDS: Record<string, 'knife' | 'gunshot' | 'drone' | 'nuke'> = {
  knife: 'knife',
  gun: 'gunshot',
  soldier: 'gunshot',
  drone: 'drone',
  nuke: 'nuke',
  emp: 'drone',
  malware: 'knife',
}

interface AttackModalProps {
  targetType: 'user' | 'spit'
  targetId: string
  targetName: string
  onClose: () => void
  onAttackComplete: (result: { newHp: number; destroyed: boolean; damage: number }) => void
}

interface AttackResult {
  damage: number
  newHp: number
  destroyed: boolean
  blocked?: boolean
  blockedBy?: string
  reflected?: boolean
  reflectedDamage?: number
  critical?: boolean
  buffsStripped?: boolean
  stolenItem?: { type: string; name: string; emoji: string }
}

export function AttackModal({ targetType, targetId, targetName, onClose, onAttackComplete }: AttackModalProps) {
  const { user } = useAuthStore()
  const { getQuantity, refreshInventory } = useInventory()
  const { playSound } = useSound()
  const { awardXP } = useXP()
  const [attacking, setAttacking] = useState(false)
  const [result, setResult] = useState<AttackResult | null>(null)
  const [sprayResult, setSprayResult] = useState<boolean | null>(null)

  // Only show weapons the user actually owns
  const ownedWeapons = WEAPONS.filter(w => getQuantity(w.type) > 0)
  const hasSprayPaint = targetType === 'user' && getQuantity('spray_paint') > 0
  const hasNothing = ownedWeapons.length === 0 && !hasSprayPaint

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
      if (data.reflected) {
        playSound('block')
        setResult({
          damage: 0,
          newHp: data.newHp ?? 0,
          destroyed: false,
          reflected: true,
          reflectedDamage: data.reflectedDamage,
          blockedBy: 'mirror_shield',
        })
        await refreshInventory()
      } else if (data.blocked) {
        playSound('block')
        setResult({ damage: 0, newHp: data.newHp ?? 0, destroyed: false, blocked: true, blockedBy: data.blockedBy })
        await refreshInventory()
      } else {
        playSound(WEAPON_SOUNDS[weapon.type] || 'knife')
        if (data.destroyed) {
          setTimeout(() => playSound('destroy'), 400)
        }
        awardXP('attack', targetId)
        setResult({
          damage: data.damage,
          newHp: data.newHp,
          destroyed: data.destroyed,
          critical: data.critical,
          buffsStripped: data.buffsStripped,
          stolenItem: data.stolenItem,
        })
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
      playSound('spraypaint')
      setSprayResult(true)
      await refreshInventory()
    } else {
      toast.error(data.error || 'Spray paint failed')
    }

    setAttacking(false)
  }

  return (
    <div className="pin-modal-overlay" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
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
            {result.reflected ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🪞</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#a855f7', fontFamily: 'var(--sys-font-display)' }}>
                  REFLECTED!
                </div>
                <p style={{ color: 'var(--sys-text-muted)', marginTop: '0.5rem' }}>
                  {targetName}&apos;s Mirror Shield reflected {result.reflectedDamage} damage back at you!
                </p>
              </>
            ) : result.blocked ? (
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
                <div className="attack-damage-display">
                  {result.critical && <div style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: 'bold', marginBottom: '0.25rem' }}>CRITICAL HIT!</div>}
                  -{result.damage}
                </div>
                <p style={{ color: 'var(--sys-text-muted)', marginTop: '0.5rem' }}>
                  {result.destroyed
                    ? `${targetName} has been DESTROYED!`
                    : `${targetName} now has ${result.newHp} HP remaining.`}
                </p>
                {result.buffsStripped && (
                  <p style={{ color: '#06b6d4', marginTop: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚡ All defense buffs stripped!
                  </p>
                )}
                {result.stolenItem && (
                  <p style={{ color: '#a855f7', marginTop: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    🦠 Stole {result.stolenItem.emoji} {result.stolenItem.name}!
                  </p>
                )}
              </>
            )}
            <button className="btn btn-outline" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </div>
        ) : (
          <div className="pin-modal-body attack-modal-body">
            {hasNothing ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ color: 'var(--sys-text-muted)', margin: '0 0 0.75rem' }}>
                  You don&apos;t have any weapons. Buy some from the shop!
                </p>
                <a href="/shop" className="btn btn-primary">Go to Shop</a>
              </div>
            ) : (
              <>
                <div className="attack-weapon-list">
                  {ownedWeapons.map((weapon) => {
                    const qty = getQuantity(weapon.type)
                    return (
                      <button
                        key={weapon.type}
                        className="attack-weapon-btn"
                        onClick={() => handleAttack(weapon)}
                        disabled={attacking}
                      >
                        <span className="attack-weapon-emoji">{weapon.emoji}</span>
                        <div className="attack-weapon-info">
                          <span className="attack-weapon-name">{weapon.name}</span>
                          <span className="attack-weapon-dmg">
                            {weapon.damage} DMG
                            {weapon.type === 'emp' && <span style={{ color: '#06b6d4' }}> + strip</span>}
                            {weapon.type === 'malware' && <span style={{ color: '#a855f7' }}> + steal</span>}
                          </span>
                        </div>
                        <span className="attack-weapon-qty">x{qty}</span>
                      </button>
                    )
                  })}
                </div>

                {hasSprayPaint && (
                  <div style={{ borderTop: '1px solid var(--sys-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <button
                      className="attack-weapon-btn attack-weapon-btn-util"
                      onClick={handleSprayPaint}
                      disabled={attacking}
                    >
                      <span className="attack-weapon-emoji">🎨</span>
                      <div className="attack-weapon-info">
                        <span className="attack-weapon-name">Spray Paint</span>
                        <span className="attack-weapon-dmg" style={{ color: 'var(--sys-success)' }}>TAG 24h</span>
                      </div>
                      <span className="attack-weapon-qty">x{getQuantity('spray_paint')}</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {attacking && (
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
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
