import { z } from 'zod'
import { pageInputSchema } from '#wallet'

export const userStatusSchema = z.enum(['ACTIVE', 'FROZEN', 'BANNED'])

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  phone: z.string().nullable(),
  status: userStatusSchema,
  isAdmin: z.boolean(),
  balance: z.number(),
  createdAt: z.number(),
  // Other accounts that signed up from the same IP (bonus-farming signal).
  sameIpAccounts: z.number(),
})

export const adminSearchUsersInputSchema = z.object({
  query: z.string().trim().min(1).max(60),
})

export const adminSetStatusInputSchema = z.object({
  userId: z.string(),
  status: userStatusSchema,
  reason: z.string().trim().min(3).max(200),
})

export const adminAdjustCoinsInputSchema = z.object({
  userId: z.string(),
  // + credit, − debit
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, 'Amount must not be 0'),
  reason: z.string().trim().min(3).max(200),
  idempotencyKey: z.uuid(),
})

export const adminLedgerInputSchema = pageInputSchema.extend({ userId: z.string() })

export const adminLedgerEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  amount: z.number(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdAt: z.number(),
})

export const adminRoomSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  status: z.enum(['OPEN', 'PAUSED', 'CLOSED']),
  host: z.object({ id: z.string(), displayName: z.string() }),
  bankBalance: z.number(),
  rounds: z.number(),
  createdAt: z.number(),
})

export const adminSettingsSchema = z.record(z.string(), z.number())

export const adminUpdateSettingInputSchema = z.object({
  key: z.string(),
  value: z.number().int().nonnegative(),
})

export const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  action: z.string(),
  target: z.string().nullable(),
  data: z.unknown(),
  createdAt: z.number(),
})

// Host/player collusion signal: a player who took a lot from one host's bank.
export const collusionFlagSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  host: z.object({ id: z.string(), displayName: z.string() }),
  player: z.object({ id: z.string(), displayName: z.string() }),
  netWon: z.number(),
  bets: z.number(),
})
