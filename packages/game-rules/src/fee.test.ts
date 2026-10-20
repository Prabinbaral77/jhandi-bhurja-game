import { describe, expect, it } from 'vitest'
import { platformFeeFor } from '#fee'

describe('platform fee (200 bps = 2 %)', () => {
  it('charges 2 % of host profit', () => {
    expect(platformFeeFor(1_000, 200)).toBe(20)
  })

  it('rounds down to whole coins', () => {
    expect(platformFeeFor(149, 200)).toBe(2) // 2.98
    expect(platformFeeFor(49, 200)).toBe(0) // 0.98
  })

  it('charges nothing when the host breaks even or loses', () => {
    expect(platformFeeFor(0, 200)).toBe(0)
    expect(platformFeeFor(-500, 200)).toBe(0)
  })

  it('rejects invalid rates', () => {
    expect(() => platformFeeFor(100, 10_001)).toThrow(RangeError)
    expect(() => platformFeeFor(100, 1.5)).toThrow(RangeError)
  })
})
