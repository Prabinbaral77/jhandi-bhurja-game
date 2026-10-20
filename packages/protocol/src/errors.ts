import { z } from 'zod'

// docs/api-protocol.md §1.1
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INSUFFICIENT_BALANCE',
  'BELOW_MIN_DEPOSIT',
  'ALREADY_CLAIMED',
  'INVALID_CODE',
  'ROOM_LOCKED',
  'ROOM_FULL',
  'ROOM_CLOSED',
  'NOT_BETTING',
  'NOT_A_PLAYER',
  'BELOW_MIN',
  'ABOVE_MAX',
  'BANK_LIMIT_REACHED',
  'INTERNAL',
] as const

export const errorCodeSchema = z.enum(ERROR_CODES)

export type ErrorCode = z.infer<typeof errorCodeSchema>

export const appErrorShapeSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type AppErrorShape = z.infer<typeof appErrorShapeSchema>
