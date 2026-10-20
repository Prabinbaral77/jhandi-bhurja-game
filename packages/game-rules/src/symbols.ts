import { z } from 'zod'

// Face-index order is part of the fairness proof (docs/game-rules.md §1). Never reorder.
export const SYMBOLS = ['CROWN', 'FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB'] as const

export const symbolSchema = z.enum(SYMBOLS)

export type GameSymbol = z.infer<typeof symbolSchema>

export const DICE_COUNT = 6

export const symbolFromFace = (face: number): GameSymbol => {
  const symbol = SYMBOLS[face]
  if (symbol === undefined) throw new RangeError(`Invalid face index: ${face}`)
  return symbol
}
