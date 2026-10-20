import { describe, expect, it } from 'vitest'
import type { Bet } from '#bet'
import { settleRound } from '#settlement'

const bet = (betId: string, userId: string, symbol: Bet['symbol'], amount: number): Bet => ({
  betId,
  userId,
  symbol,
  amount,
})

describe('settleRound', () => {
  it('matches the worked example in docs/game-rules.md §3.2', () => {
    const result = settleRound({
      bankBefore: 5_000,
      feeBps: 200,
      dice: ['CROWN', 'CROWN', 'CROWN', 'HEART', 'SPADE', 'CLUB'],
      bets: [
        bet('b1', 'ram', 'CROWN', 100),
        bet('b2', 'sita', 'HEART', 200),
        bet('b3', 'hari', 'CROWN', 50),
        bet('b4', 'hari', 'FLAG', 50),
      ],
    })

    const byId = Object.fromEntries(result.bets.map((r) => [r.betId, r]))
    expect(byId.b1).toMatchObject({ matches: 3, won: true, stakeReturned: 100, winnings: 300 })
    expect(byId.b3).toMatchObject({ matches: 3, won: true, stakeReturned: 50, winnings: 150 })
    expect(byId.b2).toMatchObject({ matches: 1, won: false, lostStake: 200, winnings: 0 })
    expect(byId.b4).toMatchObject({ matches: 0, won: false, lostStake: 50, winnings: 0 })

    expect(result).toMatchObject({
      losingStakes: 250,
      winningsPaid: 450,
      hostNet: -200,
      platformFee: 0,
      bankAfter: 4_800,
    })
  })

  it('takes the fee from host profit', () => {
    const result = settleRound({
      bankBefore: 5_000,
      feeBps: 200,
      dice: ['CLUB', 'CLUB', 'SPADE', 'SPADE', 'HEART', 'DIAMOND'],
      bets: [bet('b1', 'ram', 'CROWN', 1_000), bet('b2', 'sita', 'FLAG', 500)],
    })
    expect(result).toMatchObject({ hostNet: 1_500, platformFee: 30, bankAfter: 6_470 })
  })

  it('settles an empty round', () => {
    const result = settleRound({
      bankBefore: 5_000,
      feeBps: 200,
      dice: ['CROWN', 'FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB'],
      bets: [],
    })
    expect(result).toMatchObject({ hostNet: 0, platformFee: 0, bankAfter: 5_000 })
  })

  it('refuses to settle into a negative bank', () => {
    expect(() =>
      settleRound({
        bankBefore: 100,
        feeBps: 200,
        dice: ['CROWN', 'CROWN', 'CROWN', 'CROWN', 'CROWN', 'CROWN'],
        bets: [bet('b1', 'ram', 'CROWN', 100)],
      }),
    ).toThrow(/negative/)
  })
})
