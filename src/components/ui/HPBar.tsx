'use client'

interface HPBarProps {
  hp: number
  maxHp: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function HPBar({ hp, maxHp, size = 'md', showLabel = true }: HPBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const isLow = pct <= 25
  const isMid = pct > 25 && pct <= 60

  return (
    <div className={`hp-bar-wrap hp-bar-wrap-${size}`}>
      {showLabel && (
        <div className="hp-bar-info">
          <span className="hp-bar-label-text">HP</span>
          <span className={`hp-bar-value ${isLow ? 'hp-low' : isMid ? 'hp-mid' : 'hp-high'}`}>
            {hp}/{maxHp}
          </span>
        </div>
      )}
      <div className="hp-bar-track">
        <div
          className={`hp-bar-fill-inner ${isLow ? 'hp-fill-low' : isMid ? 'hp-fill-mid' : 'hp-fill-high'} ${isLow ? 'hp-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
        <div className="hp-bar-scanlines" />
      </div>
    </div>
  )
}
