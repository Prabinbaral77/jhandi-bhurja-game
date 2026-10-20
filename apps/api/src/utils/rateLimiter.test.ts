import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '#utils/rateLimiter'

describe('rate limiter', () => {
  it('allows up to the limit per window, then reports the wait', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 })
    expect(limiter.hit('ip', 0)).toBe(0)
    expect(limiter.hit('ip', 100)).toBe(0)
    expect(limiter.hit('ip', 200)).toBe(800)
    expect(limiter.hit('ip', 1_000)).toBe(0)
  })
})
