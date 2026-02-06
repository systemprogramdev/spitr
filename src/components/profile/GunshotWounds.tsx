'use client'

interface GunshotWoundsProps {
  hp: number
  maxHp: number
  userId: string
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

export function GunshotWounds({ hp, maxHp, userId }: GunshotWoundsProps) {
  const hpLost = maxHp - Math.max(0, hp)
  const woundCount = Math.floor(hpLost / 500)

  if (woundCount <= 0) return null

  const rng = mulberry32(hashString(userId))

  const wounds: Array<{ top: string; left: string; rotation: number; scale: number }> = []
  for (let i = 0; i < woundCount; i++) {
    wounds.push({
      top: `${10 + rng() * 80}%`,
      left: `${5 + rng() * 90}%`,
      rotation: rng() * 360,
      scale: 0.8 + rng() * 0.4,
    })
  }

  return (
    <div className="gunshot-wounds-overlay">
      {wounds.map((w, i) => (
        <img
          key={i}
          src="/gunshotwound.png"
          alt=""
          draggable={false}
          className="gunshot-wound"
          style={{
            top: w.top,
            left: w.left,
            transform: `translate(-50%, -50%) rotate(${w.rotation}deg) scale(${w.scale})`,
          }}
        />
      ))}
    </div>
  )
}
