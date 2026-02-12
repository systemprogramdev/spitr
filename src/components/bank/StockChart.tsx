'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { getStockPriceHistory, StockDataPoint } from '@/lib/bank'

interface StockChartProps {
  days?: number
  width?: number
  height?: number
}

function formatTime(ts: number, days: number): string {
  const d = new Date(ts)
  if (days <= 1) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (days <= 14) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function StockChart({ days = 30, width = 600, height = 220 }: StockChartProps) {
  const ppd = days <= 1 ? 24 : days <= 7 ? 12 : days <= 14 ? 6 : 4
  const data = useMemo(() => getStockPriceHistory(days, ppd), [days, ppd])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const getBarIndex = useCallback((clientX: number) => {
    if (!svgRef.current || data.length < 2) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = x / rect.width
    const padLeftRatio = 45 / width
    const padRightRatio = 10 / width
    const chartRatio = (ratio - padLeftRatio) / (1 - padLeftRatio - padRightRatio)
    if (chartRatio < 0 || chartRatio > 1) return null
    const idx = Math.round(chartRatio * (data.length - 1))
    return Math.max(0, Math.min(data.length - 1, idx))
  }, [data, width])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverIndex(getBarIndex(e.clientX))
  }, [getBarIndex])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setHoverIndex(getBarIndex(e.touches[0].clientX))
    }
  }, [getBarIndex])

  const handleLeave = useCallback(() => setHoverIndex(null), [])

  if (data.length < 2) return null

  const prices = data.map(d => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 0.5
  // Add 10% padding to Y range
  const yMin = minPrice - priceRange * 0.1
  const yMax = maxPrice + priceRange * 0.1
  const yRange = yMax - yMin

  const padding = { top: 20, right: 10, bottom: 24, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const barWidth = Math.max(1, (chartW / data.length) * 0.7)
  const barGap = chartW / data.length

  const toX = (i: number) => padding.left + i * barGap + barGap / 2
  const toY = (price: number) => padding.top + chartH - ((price - yMin) / yRange) * chartH

  // Y-axis tick marks (3-4 ticks)
  const tickCount = 4
  const yTicks: number[] = []
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(yMin + (yRange * i) / tickCount)
  }

  // X-axis labels (5-6 labels max)
  const xLabelCount = Math.min(6, data.length)
  const xLabelStep = Math.floor(data.length / xLabelCount)

  const currentPrice = data[data.length - 1].price
  const firstPrice = data[0].price
  const isUp = currentPrice >= firstPrice

  const hoveredPoint = hoverIndex !== null ? data[hoverIndex] : null

  return (
    <div className="stock-chart-container">
      {/* Tooltip */}
      <div className="stock-chart-tooltip-bar">
        {hoveredPoint ? (() => {
          const change = hoveredPoint.price - firstPrice
          const changePct = firstPrice > 0 ? (change / firstPrice) * 100 : 0
          return (
            <>
              <span className="stock-chart-tooltip-price" style={{
                color: hoveredPoint.price >= firstPrice ? 'var(--spit-green)' : 'var(--spit-pink)',
              }}>
                ${hoveredPoint.price.toFixed(2)}
              </span>
              <span className="stock-chart-tooltip-change" style={{
                color: change >= 0 ? 'var(--spit-green)' : 'var(--spit-pink)',
              }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
              </span>
              <span className="stock-chart-tooltip-time">
                {formatTime(hoveredPoint.time, days)}
              </span>
            </>
          )
        })() : (
          <span className="stock-chart-tooltip-hint">Tap or hover for price details</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="stock-chart-svg"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleLeave}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleLeave}
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={toY(tick)}
              x2={width - padding.right}
              y2={toY(tick)}
              stroke="var(--sys-border)"
              strokeWidth="0.5"
              strokeDasharray={i === 0 || i === tickCount ? "0" : "3,3"}
            />
            <text
              x={padding.left - 6}
              y={toY(tick) + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="var(--sys-font-mono)"
              fill="var(--sys-text-muted)"
            >
              ${tick.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Current price line */}
        <line
          x1={padding.left}
          y1={toY(currentPrice)}
          x2={width - padding.right}
          y2={toY(currentPrice)}
          stroke={isUp ? 'var(--spit-green)' : 'var(--spit-pink)'}
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.6"
        />

        {/* Bars — colored relative to period open price */}
        {data.map((d, i) => {
          const barColor = d.price >= firstPrice ? 'var(--spit-green)' : 'var(--spit-pink)'
          const isHovered = hoverIndex === i

          return (
            <rect
              key={i}
              x={toX(i) - barWidth / 2}
              y={toY(d.price)}
              width={barWidth}
              height={Math.max(1, toY(yMin) - toY(d.price))}
              fill={barColor}
              opacity={isHovered ? 1 : 0.7}
              rx="1"
            />
          )
        })}

        {/* Hover crosshair */}
        {hoverIndex !== null && (
          <>
            <line
              x1={toX(hoverIndex)}
              y1={padding.top}
              x2={toX(hoverIndex)}
              y2={padding.top + chartH}
              stroke="var(--sys-text-muted)"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.5"
            />
            <circle
              cx={toX(hoverIndex)}
              cy={toY(data[hoverIndex].price)}
              r="3.5"
              fill={data[hoverIndex].price >= firstPrice ? 'var(--spit-green)' : 'var(--spit-pink)'}
              stroke="var(--sys-bg)"
              strokeWidth="1.5"
            />
          </>
        )}

        {/* X-axis labels */}
        {Array.from({ length: xLabelCount }, (_, i) => {
          const idx = Math.min(i * xLabelStep, data.length - 1)
          return (
            <text
              key={i}
              x={toX(idx)}
              y={height - 4}
              textAnchor="middle"
              fontSize="8"
              fontFamily="var(--sys-font-mono)"
              fill="var(--sys-text-muted)"
            >
              {formatTime(data[idx].time, days)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
