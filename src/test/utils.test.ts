import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDistanceToNow, formatNumber, cn } from '@/lib/utils'

describe('formatDistanceToNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should format seconds', () => {
    const date = new Date('2024-01-15T11:59:30Z')
    expect(formatDistanceToNow(date)).toBe('30s')
  })

  it('should format minutes', () => {
    const date = new Date('2024-01-15T11:45:00Z')
    expect(formatDistanceToNow(date)).toBe('15m')
  })

  it('should format hours', () => {
    const date = new Date('2024-01-15T09:00:00Z')
    expect(formatDistanceToNow(date)).toBe('3h')
  })

  it('should format days', () => {
    const date = new Date('2024-01-13T12:00:00Z')
    expect(formatDistanceToNow(date)).toBe('2d')
  })

  it('should format weeks as date', () => {
    const date = new Date('2024-01-01T12:00:00Z')
    expect(formatDistanceToNow(date)).toBe('Jan 1')
  })

  it('should accept string dates', () => {
    const dateStr = '2024-01-15T11:55:00Z'
    expect(formatDistanceToNow(dateStr)).toBe('5m')
  })
})

describe('formatNumber', () => {
  it('should format small numbers', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1)).toBe('1')
    expect(formatNumber(999)).toBe('999')
  })

  it('should format thousands', () => {
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(10000)).toBe('10K')
    expect(formatNumber(999999)).toBe('1000K')
  })

  it('should format millions', () => {
    expect(formatNumber(1000000)).toBe('1M')
    expect(formatNumber(1500000)).toBe('1.5M')
    expect(formatNumber(10000000)).toBe('10M')
  })

  it('should remove trailing .0', () => {
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(2000)).toBe('2K')
    expect(formatNumber(1000000)).toBe('1M')
  })
})

describe('cn (classNames)', () => {
  it('should join class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should filter falsy values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar')
    expect(cn('foo', null, 'bar')).toBe('foo bar')
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('should handle empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn(false, null, undefined)).toBe('')
  })

  it('should handle single class', () => {
    expect(cn('foo')).toBe('foo')
  })
})
