// docs/game-rules.md §3 — v1 payout table, used by every room.
export const MIN_WINNING_MATCHES = 2

// Index = number of matching dice (0–6). 0 means the stake is lost.
export const PAYOUT_MULTIPLIERS = [0, 0, 2, 3, 4, 5, 6] as const

export const multiplierFor = (matches: number): number => {
  const multiplier = PAYOUT_MULTIPLIERS[matches]
  if (multiplier === undefined) throw new RangeError(`Invalid match count: ${matches}`)
  return multiplier
}

export const isWinningMatch = (matches: number): boolean => matches >= MIN_WINNING_MATCHES

// Host's result for one bet: + stake when the player loses, − winnings when the player wins.
export const hostNetForBet = (amount: number, matches: number): number =>
  isWinningMatch(matches) ? -multiplierFor(matches) * amount : amount
