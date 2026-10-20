import { describe, expect, it } from 'vitest'
import { generateServerSeed, hashServerSeed, rollDice, verifyRoll } from '#rng'
import { SYMBOLS, type GameSymbol } from '#symbols'

// Fixed vector, cross-checked against Node's built-in crypto. If this changes, every past
// round's fairness proof breaks — do not update it to make a test pass.
const VECTOR = {
  seed: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  hash: '630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd',
  round1: ['SPADE', 'DIAMOND', 'SPADE', 'FLAG', 'SPADE', 'FLAG'],
  round2: ['SPADE', 'DIAMOND', 'CLUB', 'SPADE', 'CLUB', 'FLAG'],
} as const

describe('fair RNG', () => {
  it('matches the fixed test vector', () => {
    expect(hashServerSeed(VECTOR.seed)).toBe(VECTOR.hash)
    expect(rollDice(VECTOR.seed, 'round-1')).toEqual(VECTOR.round1)
    expect(rollDice(VECTOR.seed, 'round-2')).toEqual(VECTOR.round2)
  })

  it('generates 32-byte hex seeds that differ each time', () => {
    const a = generateServerSeed()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(generateServerSeed()).not.toBe(a)
  })

  it('is deterministic for the same seed and round', () => {
    const seed = generateServerSeed()
    expect(rollDice(seed, 'r')).toEqual(rollDice(seed, 'r'))
  })

  it('verifies a genuine roll and rejects tampering', () => {
    const dice = [...VECTOR.round1] as GameSymbol[]
    expect(verifyRoll(VECTOR.seed, VECTOR.hash, 'round-1', dice).valid).toBe(true)

    const otherSeed = generateServerSeed()
    expect(verifyRoll(otherSeed, VECTOR.hash, 'round-1', dice).valid).toBe(false)

    const changedDice: GameSymbol[] = ['CROWN', ...dice.slice(1)]
    expect(verifyRoll(VECTOR.seed, VECTOR.hash, 'round-1', changedDice).valid).toBe(false)

    expect(verifyRoll('not-a-seed', VECTOR.hash, 'round-1', dice).valid).toBe(false)
  })

  it('rejects malformed seeds', () => {
    expect(() => rollDice('ABC', 'r')).toThrow()
    expect(() => hashServerSeed(VECTOR.seed.toUpperCase())).toThrow()
  })

  it('produces each face ≈ 1/6 over 1,000,000 dice', () => {
    const seed = generateServerSeed()
    const counts = new Map<GameSymbol, number>(SYMBOLS.map((s) => [s, 0]))
    const rolls = Math.ceil(1_000_000 / 6)
    for (let r = 0; r < rolls; r++) {
      for (const symbol of rollDice(seed, `round-${r}`)) {
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
      }
    }
    const totalDice = rolls * 6
    for (const symbol of SYMBOLS) {
      const share = (counts.get(symbol) ?? 0) / totalDice
      expect(Math.abs(share - 1 / 6)).toBeLessThan(0.005)
    }
  }, 60_000)
})
