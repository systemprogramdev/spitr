'use client'

interface HPBarProps {
  hp: number
  maxHp: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function HPBar({ hp, maxHp, size = 'md', showLabel = true }: HPBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const color = pct > 60 ? 'var(--sys-primary)' : pct > 25 ? 'var(--spit-yellow)' : 'var(--sys-danger)'

  const heights = { sm: '4px', md: '8px', lg: '12px' }

  return (
    <div className="hp-bar-container">
      {showLabel && (
        <span className="hp-bar-label" style={{ color }}>
          {hp}/{maxHp} HP
        </span>
      )}
      <div className="hp-bar" style={{ height: heights[size] }}>
        <div
          className="hp-bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  )
}
