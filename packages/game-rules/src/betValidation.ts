import type { ErrorCode } from '@jhandi/protocol/errors'
import type { Bet } from '#bet'
import { canBankCover } from '#exposure'
import type { RoomLimits } from '#limits'
import type { GameSymbol } from '#symbols'

export type BetRejection = Extract<
  ErrorCode,
  | 'NOT_BETTING'
  | 'NOT_A_PLAYER'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'INSUFFICIENT_BALANCE'
  | 'BANK_LIMIT_REACHED'
>

export interface BetAttempt {
  isBettingOpen: boolean
  isPlayer: boolean
  isHost: boolean
  userId: string
  symbol: GameSymbol
  amount: number
  walletBalance: number
  bankBefore: number
  limits: RoomLimits
  // All bets already accepted this round, from every player.
  roundBets: readonly Pick<Bet, 'userId' | 'symbol' | 'amount'>[]
}

const sumAmounts = (bets: readonly Pick<Bet, 'amount'>[]): number =>
  bets.reduce((sum, bet) => sum + bet.amount, 0)

// docs/game-rules.md §2.1 — checks run in this order; the first failure is returned.
export const validateBet = (attempt: BetAttempt): BetRejection | null => {
  const { amount, limits, roundBets, symbol, userId } = attempt

  if (!attempt.isBettingOpen) return 'NOT_BETTING'
  if (!attempt.isPlayer || attempt.isHost) return 'NOT_A_PLAYER'
  if (!Number.isSafeInteger(amount) || amount < limits.minBet) return 'BELOW_MIN'

  const playerBets = roundBets.filter((bet) => bet.userId === userId)
  const onSymbol = sumAmounts(playerBets.filter((bet) => bet.symbol === symbol)) + amount
  const inRound = sumAmounts(playerBets) + amount
  if (onSymbol > limits.maxBetPerSymbol || inRound > limits.maxBetPerPlayerPerRound) {
    return 'ABOVE_MAX'
  }

  if (attempt.walletBalance < amount) return 'INSUFFICIENT_BALANCE'
  if (!canBankCover(attempt.bankBefore, [...roundBets, { symbol, amount }])) {
    return 'BANK_LIMIT_REACHED'
  }
  return null
}
