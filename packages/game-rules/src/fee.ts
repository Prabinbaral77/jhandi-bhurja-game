import { assertCoinAmount } from '#coins'

export const BASIS_POINTS = 10_000

// docs/game-rules.md §3.1 — fee only on host profit, rounded down to whole coins.
export const platformFeeFor = (hostNet: number, feeBps: number): number => {
  assertCoinAmount(feeBps, 'feeBps')
  if (feeBps > BASIS_POINTS) throw new RangeError(`feeBps cannot exceed ${BASIS_POINTS}`)
  if (hostNet <= 0) return 0
  return Math.floor((hostNet * feeBps) / BASIS_POINTS)
}
