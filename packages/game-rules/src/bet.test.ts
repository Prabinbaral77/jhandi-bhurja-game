import { describe, expect, it } from 'vitest'
import { betSchema } from '#bet'

describe('betSchema', () => {
  it('accepts a valid bet', () => {
    expect(betSchema.parse({ betId: 'b1', userId: 'u1', symbol: 'FLAG', amount: 50 })).toEqual({
      betId: 'b1',
      userId: 'u1',
      symbol: 'FLAG',
      amount: 50,
    })
  })

  it.each([
    { betId: 'b1', userId: 'u1', symbol: 'JOKER', amount: 50 },
    { betId: 'b1', userId: 'u1', symbol: 'FLAG', amount: 0 },
    { betId: 'b1', userId: 'u1', symbol: 'FLAG', amount: 2.5 },
    { betId: '', userId: 'u1', symbol: 'FLAG', amount: 50 },
  ])('rejects %o', (input) => {
    expect(betSchema.safeParse(input).success).toBe(false)
  })
})
