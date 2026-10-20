import type { Bet } from '#bet'
import { assertCoinAmount } from '#coins'
import { countSymbols, type SymbolCounts } from '#dice'
import { platformFeeFor } from '#fee'
import { isWinningMatch, multiplierFor } from '#payout'
import type { GameSymbol } from '#symbols'

export interface BetResult {
  betId: string
  userId: string
  symbol: GameSymbol
  amount: number
  matches: number
  won: boolean
  stakeReturned: number
  winnings: number
  lostStake: number
}

export interface RoundSettlement {
  counts: SymbolCounts
  bets: BetResult[]
  losingStakes: number
  winningsPaid: number
  hostNet: number
  platformFee: number
  bankAfter: number
}

export interface SettleRoundInput {
  bets: readonly Bet[]
  dice: readonly GameSymbol[]
  bankBefore: number
  feeBps: number
}

// docs/game-rules.md §3.1. Pure: the ledger turns this into coin movements.
export const settleRound = ({
  bets,
  dice,
  bankBefore,
  feeBps,
}: SettleRoundInput): RoundSettlement => {
  assertCoinAmount(bankBefore, 'bankBefore')
  const counts = countSymbols(dice)

  const results = bets.map((bet): BetResult => {
    assertCoinAmount(bet.amount, `bet ${bet.betId} amount`)
    const matches = counts[bet.symbol]
    const won = isWinningMatch(matches)
    return {
      ...bet,
      matches,
      won,
      stakeReturned: won ? bet.amount : 0,
      winnings: won ? multiplierFor(matches) * bet.amount : 0,
      lostStake: won ? 0 : bet.amount,
    }
  })

  const losingStakes = results.reduce((sum, r) => sum + r.lostStake, 0)
  const winningsPaid = results.reduce((sum, r) => sum + r.winnings, 0)
  const hostNet = losingStakes - winningsPaid
  const platformFee = platformFeeFor(hostNet, feeBps)
  const bankAfter = bankBefore + hostNet - platformFee

  // The exposure check (§4) must make this impossible; fail loudly if it ever happens.
  if (bankAfter < 0) {
    throw new Error(`Bank would go negative (${bankAfter}); exposure check was bypassed`)
  }

  return { counts, bets: results, losingStakes, winningsPaid, hostNet, platformFee, bankAfter }
}
