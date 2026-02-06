'use client'

import { levelColor } from '@/lib/xp'

interface LevelBadgeProps {
  level: number
}

export function LevelBadge({ level }: LevelBadgeProps) {
  const color = levelColor(level)

  return (
    <span
      className="level-badge"
      style={{
        color,
        borderColor: color,
      }}
    >
      Lv.{level}
    </span>
  )
}
