import { describe, expect, it } from 'vitest'
import { validateBet, type BetAttempt } from '#betValidation'
import { DEFAULT_ROOM_LIMITS } from '#limits'

const attempt = (overrides: Partial<BetAttempt> = {}): BetAttempt => ({
  isBettingOpen: true,
  isPlayer: true,
  isHost: false,
  userId: 'ram',
  symbol: 'CROWN',
  amount: 100,
  walletBalance: 5_500,
  bankBefore: 5_000,
  limits: DEFAULT_ROOM_LIMITS,
  roundBets: [],
  ...overrides,
})

describe('validateBet', () => {
  it('accepts a normal bet', () => {
    expect(validateBet(attempt())).toBeNull()
  })

  it('rejects when betting is closed', () => {
    expect(validateBet(attempt({ isBettingOpen: false }))).toBe('NOT_BETTING')
  })

  it('rejects spectators and the host', () => {
    expect(validateBet(attempt({ isPlayer: false }))).toBe('NOT_A_PLAYER')
    expect(validateBet(attempt({ isHost: true }))).toBe('NOT_A_PLAYER')
  })

  it('rejects amounts below the minimum or not whole coins', () => {
    expect(validateBet(attempt({ amount: 9 }))).toBe('BELOW_MIN')
    expect(validateBet(attempt({ amount: 10.5 }))).toBe('BELOW_MIN')
  })

  it('applies the per-symbol limit including earlier bets', () => {
    // Big bank so the exposure check doesn't interfere (1,000 on CROWN can cost the bank 6,000).
    const roundBets = [{ userId: 'ram', symbol: 'CROWN' as const, amount: 950 }]
    expect(validateBet(attempt({ amount: 50, roundBets, bankBefore: 100_000 }))).toBeNull()
    expect(validateBet(attempt({ amount: 60, roundBets, bankBefore: 100_000 }))).toBe('ABOVE_MAX')
  })

  it('applies the per-round limit across symbols', () => {
    const roundBets = [
      { userId: 'ram', symbol: 'FLAG' as const, amount: 1_000 },
      { userId: 'ram', symbol: 'HEART' as const, amount: 1_000 },
      { userId: 'sita', symbol: 'SPADE' as const, amount: 1_000 },
    ]
    expect(validateBet(attempt({ amount: 1_000, roundBets, bankBefore: 100_000 }))).toBeNull()
    expect(validateBet(attempt({ amount: 1_001, roundBets, bankBefore: 100_000 }))).toBe(
      'ABOVE_MAX',
    )
  })

  it('rejects when the wallet is too low', () => {
    expect(validateBet(attempt({ walletBalance: 99 }))).toBe('INSUFFICIENT_BALANCE')
  })

  it('rejects when the bank cannot cover the worst case', () => {
    expect(validateBet(attempt({ amount: 100, bankBefore: 600 }))).toBeNull()
    expect(validateBet(attempt({ amount: 100, bankBefore: 599 }))).toBe('BANK_LIMIT_REACHED')
  })

  it('returns the first failing check in the documented order', () => {
    expect(validateBet(attempt({ isBettingOpen: false, amount: 1, walletBalance: 0 }))).toBe(
      'NOT_BETTING',
    )
    expect(validateBet(attempt({ amount: 5_000, walletBalance: 0 }))).toBe('ABOVE_MAX')
  })
})
