'use client'

import { useMemo } from 'react'
import { getStockPriceHistory, StockDataPoint } from '@/lib/bank'

interface StockChartProps {
  days?: number
  width?: number
  height?: number
}

export function StockChart({ days = 30, width = 600, height = 200 }: StockChartProps) {
  const data = useMemo(() => getStockPriceHistory(days, 4), [days])

  if (data.length < 2) return null

  const prices = data.map(d => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice || 1

  const padding = { top: 10, right: 10, bottom: 10, left: 10 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * chartW
  const toY = (price: number) => padding.top + chartH - ((price - minPrice) / range) * chartH

  const points = data.map((d, i) => `${toX(i)},${toY(d.price)}`).join(' ')
  const fillPoints = `${toX(0)},${padding.top + chartH} ${points} ${toX(data.length - 1)},${padding.top + chartH}`

  const isUp = data[data.length - 1].price >= data[0].price
  const color = isUp ? 'var(--spit-green)' : 'var(--spit-pink)'
  const gradientId = `stock-grad-${days}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="stock-chart-svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={fillPoints}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
