import { describe, expect, it } from 'vitest'
import { emptyCounts, type SymbolCounts } from '#dice'
import { canBankCover, worstCaseHostNet } from '#exposure'
import { hostNetForBet } from '#payout'
import { SYMBOLS } from '#symbols'

// Independent check: walk all 6^6 = 46,656 ordered rolls instead of the 462 count vectors.
const bruteForceWorstCase = (totals: SymbolCounts): number => {
  let worst = Number.POSITIVE_INFINITY
  for (let roll = 0; roll < 6 ** 6; roll++) {
    const counts = emptyCounts()
    let rest = roll
    for (let die = 0; die < 6; die++) {
      const symbol = SYMBOLS[rest % 6]
      if (symbol) counts[symbol] += 1
      rest = Math.floor(rest / 6)
    }
    const net = SYMBOLS.reduce((sum, s) => sum + hostNetForBet(totals[s], counts[s]), 0)
    worst = Math.min(worst, net)
  }
  return worst
}

const totals = (partial: Partial<SymbolCounts>): SymbolCounts => ({ ...emptyCounts(), ...partial })

describe('bank exposure', () => {
  it('worst case for one bet is all six dice matching (−6 × stake)', () => {
    expect(worstCaseHostNet(totals({ CROWN: 100 }))).toBe(-600)
  })

  it('accepts a bet exactly at the limit and rejects one coin over', () => {
    expect(canBankCover(600, [{ symbol: 'CROWN', amount: 100 }])).toBe(true)
    expect(canBankCover(599, [{ symbol: 'CROWN', amount: 100 }])).toBe(false)
  })

  it('counts losing stakes on other symbols as offset', () => {
    // 6 × CROWN pays 600 but FLAG's 100 is lost → −500; 3 CROWN + 3 FLAG → −600 is worse.
    expect(worstCaseHostNet(totals({ CROWN: 100, FLAG: 100 }))).toBe(-600)
  })

  it('an empty round has no exposure', () => {
    expect(worstCaseHostNet(emptyCounts())).toBe(0)
  })

  it.each([
    totals({ CROWN: 100, FLAG: 250, HEART: 40 }),
    totals({ CROWN: 1_000, FLAG: 1_000, HEART: 1_000, SPADE: 1_000, DIAMOND: 1_000, CLUB: 1_000 }),
    totals({ SPADE: 7, CLUB: 3_000 }),
    totals({ CROWN: 500, FLAG: 20, HEART: 20, SPADE: 20, DIAMOND: 20, CLUB: 20 }),
  ])('matches a brute-force search over all 46,656 rolls (%o)', (t) => {
    expect(worstCaseHostNet(t)).toBe(bruteForceWorstCase(t))
  })
})
