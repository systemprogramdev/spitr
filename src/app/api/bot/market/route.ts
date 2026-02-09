import { NextResponse } from 'next/server'
import { getCurrentDailyRate, getStockPrice, RATE_PERIOD_MS, MIN_RATE, MAX_RATE } from '@/lib/bank'

export async function GET() {
  const now = new Date()
  const rate = getCurrentDailyRate(now)
  const stockPrice = getStockPrice(now)

  // Rate trend: derivative of sin wave
  // rate = MIN + (sin(t * 2π) + 1)/2 * (MAX - MIN)
  // derivative proportional to cos(t * 2π)
  const t = now.getTime() / RATE_PERIOD_MS
  const cosValue = Math.cos(t * 2 * Math.PI)
  const rateRising = cosValue > 0

  // Signal: bank when rate is high, trade (buy stock) when rate is low
  const ratePercent = rate * 100
  const signal = ratePercent >= 0.85 ? 'bank' : 'trade'

  // Time to next peak/trough
  // Peak when sin(t * 2π) = 1, i.e. t = 0.25 + n
  // Trough when sin(t * 2π) = -1, i.e. t = 0.75 + n
  const fractional = t % 1
  let timeToPeakHours: number
  let timeToTroughHours: number

  if (fractional < 0.25) {
    timeToPeakHours = (0.25 - fractional) * 12
    timeToTroughHours = (0.75 - fractional) * 12
  } else if (fractional < 0.75) {
    timeToPeakHours = (1.25 - fractional) * 12
    timeToTroughHours = (0.75 - fractional) * 12
  } else {
    timeToPeakHours = (1.25 - fractional) * 12
    timeToTroughHours = (1.75 - fractional) * 12
  }

  // Stock trend: compare to price 1 hour ago
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const stockPriceHourAgo = getStockPrice(oneHourAgo)
  const stockTrend = stockPrice > stockPriceHourAgo ? 'rising' : stockPrice < stockPriceHourAgo ? 'falling' : 'flat'

  return NextResponse.json({
    current_rate: Math.round(rate * 100000) / 100000,
    current_rate_percent: Math.round(ratePercent * 100) / 100,
    min_rate_percent: MIN_RATE * 100,
    max_rate_percent: MAX_RATE * 100,
    rate_trend: rateRising ? 'rising' : 'falling',
    signal,
    time_to_peak_hours: Math.round(timeToPeakHours * 100) / 100,
    time_to_trough_hours: Math.round(timeToTroughHours * 100) / 100,
    stock_price: stockPrice,
    stock_trend: stockTrend,
    stock_price_1h_ago: stockPriceHourAgo,
    timestamp: now.toISOString(),
  })
}
