import { describe, expect, it } from 'vitest'
import { ALL_OUTCOMES, outcomeProbability } from '#dice'
import { hostNetForBet, isWinningMatch, multiplierFor } from '#payout'

describe('payout table', () => {
  it.each([
    [0, false, 0],
    [1, false, 0],
    [2, true, 2],
    [3, true, 3],
    [4, true, 4],
    [5, true, 5],
    [6, true, 6],
  ])('k=%i → wins=%s, multiplier=%i', (k, wins, multiplier) => {
    expect(isWinningMatch(k)).toBe(wins)
    expect(multiplierFor(k)).toBe(multiplier)
  })

  it('rejects impossible match counts', () => {
    expect(() => multiplierFor(7)).toThrow(RangeError)
    expect(() => multiplierFor(-1)).toThrow(RangeError)
  })

  it('host gains the stake on a loss and pays winnings on a win', () => {
    expect(hostNetForBet(100, 1)).toBe(100)
    expect(hostNetForBet(100, 3)).toBe(-300)
  })

  it('player expected value is exactly −6469/46656 (≈ −13.87 %)', () => {
    // One coin on CROWN; player net = winnings on a win, −1 on a loss.
    const ev = ALL_OUTCOMES.reduce(
      (sum, outcome) => sum + outcomeProbability(outcome) * -hostNetForBet(1, outcome.CROWN),
      0,
    )
    expect(ev).toBeCloseTo(-6469 / 46656, 12)
  })
})
