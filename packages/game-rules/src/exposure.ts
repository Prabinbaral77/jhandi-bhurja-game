import type { Bet } from '#bet'
import { ALL_OUTCOMES, emptyCounts, type SymbolCounts } from '#dice'
import { hostNetForBet } from '#payout'
import { SYMBOLS } from '#symbols'

export const totalsBySymbol = (bets: readonly Pick<Bet, 'symbol' | 'amount'>[]): SymbolCounts => {
  const totals = emptyCounts()
  for (const bet of bets) totals[bet.symbol] += bet.amount
  return totals
}

const hostNetForOutcome = (totals: SymbolCounts, outcome: SymbolCounts): number =>
  SYMBOLS.reduce((sum, symbol) => sum + hostNetForBet(totals[symbol], outcome[symbol]), 0)

// docs/game-rules.md §4 — the host's worst result over all 462 outcomes (≤ 0 means a loss).
export const worstCaseHostNet = (totals: SymbolCounts): number =>
  ALL_OUTCOMES.reduce(
    (worst, outcome) => Math.min(worst, hostNetForOutcome(totals, outcome)),
    Number.POSITIVE_INFINITY,
  )

// True when the bank can pay every possible outcome of the round with this bet added.
export const canBankCover = (
  bankBefore: number,
  roundBets: readonly Pick<Bet, 'symbol' | 'amount'>[],
): boolean => bankBefore + worstCaseHostNet(totalsBySymbol(roundBets)) >= 0
