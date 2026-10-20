import { describe, expect, it } from 'vitest'
import { ALL_OUTCOMES, countSymbols, outcomeProbability } from '#dice'
import { SYMBOLS } from '#symbols'

describe('dice outcomes', () => {
  it('has 462 unique outcomes, each summing to 6 dice', () => {
    expect(ALL_OUTCOMES).toHaveLength(462)
    const keys = new Set(ALL_OUTCOMES.map((o) => SYMBOLS.map((s) => o[s]).join(',')))
    expect(keys.size).toBe(462)
    for (const outcome of ALL_OUTCOMES) {
      expect(SYMBOLS.reduce((sum, s) => sum + outcome[s], 0)).toBe(6)
    }
  })

  it('outcome probabilities add up to 1', () => {
    const total = ALL_OUTCOMES.reduce((sum, o) => sum + outcomeProbability(o), 0)
    expect(total).toBeCloseTo(1, 12)
  })

  it('counts symbols in a roll', () => {
    const counts = countSymbols(['CROWN', 'CROWN', 'CROWN', 'HEART', 'SPADE', 'CLUB'])
    expect(counts).toEqual({ CROWN: 3, FLAG: 0, HEART: 1, SPADE: 1, DIAMOND: 0, CLUB: 1 })
  })

  it('rejects rolls that are not exactly 6 dice', () => {
    expect(() => countSymbols(['CROWN'])).toThrow(RangeError)
  })
})
