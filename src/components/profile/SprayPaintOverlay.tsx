'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface SprayPaintOverlayProps {
  targetUserId: string
}

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

export function SprayPaintOverlay({ targetUserId }: SprayPaintOverlayProps) {
  const [sprays, setSprays] = useState<{ id: string; sprayer_id: string }[]>([])

  useEffect(() => {
    const fetchSprays = async () => {
      const { data } = await supabase
        .from('spray_paints')
        .select('id, sprayer_id')
        .eq('target_user_id', targetUserId)
        .gt('expires_at', new Date().toISOString())

      if (data) setSprays(data)
    }
    fetchSprays()
  }, [targetUserId])

  if (sprays.length === 0) return null

  return (
    <div className="gunshot-wounds-overlay">
      {sprays.map((spray) => {
        const rng = mulberry32(hashString(spray.sprayer_id))
        const top = `${15 + rng() * 60}%`
        const left = `${10 + rng() * 80}%`
        const rotation = -30 + rng() * 60

        return (
          <img
            key={spray.id}
            src="/spraypaint.png"
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              top,
              left,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              width: '120px',
              height: 'auto',
              pointerEvents: 'none',
              opacity: 0.8,
            }}
          />
        )
      })}
    </div>
  )
}
