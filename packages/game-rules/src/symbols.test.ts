import { describe, expect, it } from 'vitest'
import { SYMBOLS, symbolFromFace } from '#symbols'

describe('symbols', () => {
  it('keeps the fixed face-index order', () => {
    expect(SYMBOLS).toEqual(['CROWN', 'FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB'])
  })

  it('maps face indexes to symbols', () => {
    expect(symbolFromFace(0)).toBe('CROWN')
    expect(symbolFromFace(5)).toBe('CLUB')
    expect(() => symbolFromFace(6)).toThrow(RangeError)
  })
})
