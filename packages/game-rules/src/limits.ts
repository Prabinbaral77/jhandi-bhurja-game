import { z } from 'zod'

// docs/game-rules.md §2.1 and §6 — host-chosen values must stay inside the platform ranges.
export const roomLimitsSchema = z
  .object({
    minBet: z.number().int().min(10).max(1_000).default(10),
    maxBetPerSymbol: z.number().int().min(100).max(10_000).default(1_000),
    maxBetPerPlayerPerRound: z.number().int().min(100).max(30_000).default(3_000),
    bettingWindowSec: z.number().int().min(10).max(60).default(20),
    resultDisplaySec: z.number().int().min(3).max(15).default(5),
  })
  .refine((l) => l.minBet <= l.maxBetPerSymbol, {
    message: 'minBet cannot be above maxBetPerSymbol',
    path: ['minBet'],
  })
  .refine((l) => l.maxBetPerSymbol <= l.maxBetPerPlayerPerRound, {
    message: 'maxBetPerSymbol cannot be above maxBetPerPlayerPerRound',
    path: ['maxBetPerSymbol'],
  })

export type RoomLimits = z.infer<typeof roomLimitsSchema>

export const DEFAULT_ROOM_LIMITS: RoomLimits = roomLimitsSchema.parse({})

export const ROLL_ANIMATION_SEC = 3
