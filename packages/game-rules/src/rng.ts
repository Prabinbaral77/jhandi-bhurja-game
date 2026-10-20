import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { DICE_COUNT, SYMBOLS, symbolFromFace, type GameSymbol } from '#symbols'

// docs/game-rules.md §5 — commit–reveal fair dice. Runs in Node and in the browser (verify).

const SEED_BYTES = 32
// Largest multiple of 6 below 256; bytes at or above it are skipped to avoid modulo bias.
const UNBIASED_LIMIT = 252
// Guard against an endless loop; reaching it is practically impossible (~10^-58 per attempt).
const MAX_ATTEMPTS = 16

const SEED_PATTERN = /^[0-9a-f]{64}$/

const assertSeed = (serverSeed: string): void => {
  if (!SEED_PATTERN.test(serverSeed)) throw new Error('serverSeed must be 64 lowercase hex chars')
}

export const generateServerSeed = (): string => bytesToHex(randomBytes(SEED_BYTES))

export const hashServerSeed = (serverSeed: string): string => {
  assertSeed(serverSeed)
  return bytesToHex(sha256(hexToBytes(serverSeed)))
}

const rollFace = (key: Uint8Array, roundId: string, dieIndex: number): number => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const digest = hmac(sha256, key, utf8ToBytes(`${roundId}:${dieIndex}:${attempt}`))
    for (const byte of digest) {
      if (byte < UNBIASED_LIMIT) return byte % SYMBOLS.length
    }
  }
  /* v8 ignore next -- needs 16 × 32 bytes all ≥ 252 in a row (p ≈ 10^-930); kept as a hard stop */
  throw new Error(`Could not roll die ${dieIndex} for round ${roundId}`)
}

export const rollDice = (serverSeed: string, roundId: string): GameSymbol[] => {
  assertSeed(serverSeed)
  const key = hexToBytes(serverSeed)
  return Array.from({ length: DICE_COUNT }, (_, i) => symbolFromFace(rollFace(key, roundId, i)))
}

export interface RollVerification {
  valid: boolean
  dice: GameSymbol[]
}

// Anyone can re-run this after the seed is revealed to check the published hash and dice.
export const verifyRoll = (
  serverSeed: string,
  seedHash: string,
  roundId: string,
  publishedDice: readonly GameSymbol[],
): RollVerification => {
  if (!SEED_PATTERN.test(serverSeed)) return { valid: false, dice: [] }
  const dice = rollDice(serverSeed, roundId)
  const valid =
    hashServerSeed(serverSeed) === seedHash.toLowerCase() &&
    dice.length === publishedDice.length &&
    dice.every((symbol, i) => symbol === publishedDice[i])
  return { valid, dice }
}
