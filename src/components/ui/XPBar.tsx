'use client'

import { xpProgress, xpForLevel } from '@/lib/xp'

interface XPBarProps {
  xp: number
  level: number
}

export function XPBar({ xp, level }: XPBarProps) {
  const progress = xpProgress(xp, level)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)

  return (
    <div className="xp-bar-wrap">
      <div className="xp-bar-info">
        <span className="xp-bar-level">Lv.{level}</span>
        <span className="xp-bar-value">
          {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
        </span>
      </div>
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill-inner"
          style={{ width: `${progress}%` }}
        />
        <div className="hp-bar-scanlines" />
      </div>
    </div>
  )
}
