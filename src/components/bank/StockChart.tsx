'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { getStockCandles } from '@/lib/bank'

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
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function StockChart({ days = 30, width = 600, height = 220 }: StockChartProps) {
  const candles = useMemo(() => getStockCandles(days), [days])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const padding = { top: 20, right: 48, bottom: 24, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getCandleIndex = useCallback((clientX: number) => {
    if (!svgRef.current || candles.length < 2) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = x / rect.width
    const padLeftRatio = padding.left / width
    const padRightRatio = padding.right / width
    const chartRatio = (ratio - padLeftRatio) / (1 - padLeftRatio - padRightRatio)
    if (chartRatio < 0 || chartRatio > 1) return null
    const idx = Math.round(chartRatio * (candles.length - 1))
    return Math.max(0, Math.min(candles.length - 1, idx))
  }, [candles, width, padding.left, padding.right])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverIndex(getCandleIndex(e.clientX))
  }, [getCandleIndex])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setHoverIndex(getCandleIndex(e.touches[0].clientX))
    }
  }, [getCandleIndex])

  const handleLeave = useCallback(() => setHoverIndex(null), [])

  if (candles.length < 2) return null

  // Compute Y range from all candle highs/lows
  let minPrice = Infinity
  let maxPrice = -Infinity
  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low
    if (c.high > maxPrice) maxPrice = c.high
  }
  const priceRange = maxPrice - minPrice || 0.5
  const yMin = minPrice - priceRange * 0.1
  const yMax = maxPrice + priceRange * 0.1
  const yRange = yMax - yMin

  const candleGap = chartW / candles.length
  const bodyWidth = Math.max(2, candleGap * 0.6)
  const wickWidth = Math.max(1, bodyWidth * 0.15)

  const toX = (i: number) => padding.left + i * candleGap + candleGap / 2
  const toY = (price: number) => padding.top + chartH - ((price - yMin) / yRange) * chartH

  // Y-axis ticks
  const tickCount = 4
  const yTicks: number[] = []
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(yMin + (yRange * i) / tickCount)
  }

  // X-axis labels
  const xLabelCount = Math.min(6, candles.length)
  const xLabelStep = Math.floor(candles.length / xLabelCount)

  const lastCandle = candles[candles.length - 1]
  const firstCandle = candles[0]
  const isUp = lastCandle.close >= firstCandle.open

  const hoveredCandle = hoverIndex !== null ? candles[hoverIndex] : null

  return (
    <div className="stock-chart-container">
      {/* Tooltip */}
      <div className="stock-chart-tooltip-bar">
        {hoveredCandle ? (() => {
          const change = hoveredCandle.close - firstCandle.open
          const changePct = firstCandle.open > 0 ? (change / firstCandle.open) * 100 : 0
          const bullish = hoveredCandle.close >= hoveredCandle.open
          return (
            <>
              <span className="stock-chart-tooltip-price" style={{
                color: bullish ? 'var(--spit-green)' : 'var(--spit-pink)',
              }}>
                ${hoveredCandle.close.toFixed(2)}
              </span>
              <span className="stock-chart-tooltip-ohlc">
                O:{hoveredCandle.open.toFixed(2)} H:{hoveredCandle.high.toFixed(2)} L:{hoveredCandle.low.toFixed(2)} C:{hoveredCandle.close.toFixed(2)}
              </span>
              <span className="stock-chart-tooltip-change" style={{
                color: change >= 0 ? 'var(--spit-green)' : 'var(--spit-pink)',
              }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
              </span>
              <span className="stock-chart-tooltip-time">
                {formatTime(hoveredCandle.time, days)}
              </span>
            </>
          )
        })() : (
          <span className="stock-chart-tooltip-hint">Tap or hover for OHLC details</span>
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
              strokeDasharray={i === 0 || i === tickCount ? '0' : '3,3'}
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

        {/* Current price dashed line */}
        <line
          x1={padding.left}
          y1={toY(lastCandle.close)}
          x2={width - padding.right}
          y2={toY(lastCandle.close)}
          stroke={isUp ? 'var(--spit-green)' : 'var(--spit-pink)'}
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.6"
        />

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const bullish = c.close >= c.open
          const color = bullish ? 'var(--spit-green)' : 'var(--spit-pink)'
          const isHovered = hoverIndex === i

          const bodyTop = toY(Math.max(c.open, c.close))
          const bodyBottom = toY(Math.min(c.open, c.close))
          const bodyH = Math.max(1, bodyBottom - bodyTop)

          const wickTop = toY(c.high)
          const wickBottom = toY(c.low)
          const cx = toX(i)

          return (
            <g key={i} opacity={isHovered ? 1 : 0.85}>
              {/* Wick (high to low) */}
              <line
                x1={cx}
                y1={wickTop}
                x2={cx}
                y2={wickBottom}
                stroke={color}
                strokeWidth={wickWidth}
              />
              {/* Body (open to close) */}
              <rect
                x={cx - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyH}
                fill={bullish ? color : color}
                stroke={color}
                strokeWidth={bullish ? 0 : 0}
                rx="0.5"
              />
            </g>
          )
        })}

        {/* Hover crosshair */}
        {hoverIndex !== null && (() => {
          const hc = candles[hoverIndex]
          const bullish = hc.close >= hc.open
          return (
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
              {/* Horizontal price line */}
              <line
                x1={padding.left}
                y1={toY(hc.close)}
                x2={width - padding.right}
                y2={toY(hc.close)}
                stroke="var(--sys-text-muted)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
                opacity="0.4"
              />
              {/* Price label on right */}
              <rect
                x={width - padding.right + 1}
                y={toY(hc.close) - 7}
                width="40"
                height="14"
                fill={bullish ? 'var(--spit-green)' : 'var(--spit-pink)'}
                rx="2"
              />
              <text
                x={width - padding.right + 4}
                y={toY(hc.close) + 3}
                fontSize="8"
                fontFamily="var(--sys-font-mono)"
                fill="var(--sys-bg)"
                fontWeight="600"
              >
                ${hc.close.toFixed(2)}
              </text>
            </>
          )
        })()}

        {/* X-axis labels */}
        {Array.from({ length: xLabelCount }, (_, i) => {
          const idx = Math.min(i * xLabelStep, candles.length - 1)
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
              {formatTime(candles[idx].time, days)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
