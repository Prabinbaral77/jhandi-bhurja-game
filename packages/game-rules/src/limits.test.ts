import { describe, expect, it } from 'vitest'
import { DEFAULT_ROOM_LIMITS, roomLimitsSchema } from '#limits'

describe('room limits', () => {
  it('has the documented defaults', () => {
    expect(DEFAULT_ROOM_LIMITS).toEqual({
      minBet: 10,
      maxBetPerSymbol: 1_000,
      maxBetPerPlayerPerRound: 3_000,
      bettingWindowSec: 20,
      resultDisplaySec: 5,
    })
  })

  it('rejects values outside platform ranges', () => {
    expect(roomLimitsSchema.safeParse({ minBet: 5 }).success).toBe(false)
    expect(roomLimitsSchema.safeParse({ bettingWindowSec: 90 }).success).toBe(false)
  })

  it('rejects inconsistent limits', () => {
    expect(roomLimitsSchema.safeParse({ minBet: 500, maxBetPerSymbol: 200 }).success).toBe(false)
    expect(
      roomLimitsSchema.safeParse({ maxBetPerSymbol: 5_000, maxBetPerPlayerPerRound: 3_000 })
        .success,
    ).toBe(false)
  })
})
