import { z } from 'zod'
import { pageInputSchema } from '#wallet'

export const userStatusSchema = z.enum(['ACTIVE', 'FROZEN', 'BANNED'])

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
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
  // Members currently seated (host + players + spectators) — 0 once closed.
  members: z.number(),
  // Platform fee collected from this room's settled rounds so far.
  platformFee: z.number(),
  // Total losing stakes / winnings paid across settled rounds (what the fee came from).
  losingStakes: z.number(),
  winningsPaid: z.number(),
  // Whether a round is in BETTING/LOCKED right now.
  roundInPlay: z.boolean(),
  lastRoundAt: z.number().nullable(),
  createdAt: z.number(),
})

export const adminRoomsInputSchema = z.object({
  // 'live' = OPEN or PAUSED rooms; 'all' includes closed rooms (latest 200).
  scope: z.enum(['live', 'all']).default('live'),
})

// One settled/voided round with the money that moved (docs/game-rules.md §4).
export const adminRoundSchema = z.object({
  roundId: z.string(),
  roundNo: z.number(),
  status: z.enum(['BETTING', 'LOCKED', 'SETTLED', 'VOIDED']),
  dice: z.array(z.string()).nullable(),
  bets: z.number(),
  staked: z.number(),
  losingStakes: z.number(),
  winningsPaid: z.number(),
  platformFee: z.number(),
  startedAt: z.number(),
  settledAt: z.number().nullable(),
})

// Live operator dashboard (docs/architecture.md §7 admin). Cached for a few seconds.
export const adminOverviewSchema = z.object({
  generatedAt: z.number(),
  rooms: z.object({
    live: z.number(),
    roundsInPlay: z.number(),
    // Members seated in live rooms right now, by role.
    hosts: z.number(),
    players: z.number(),
    spectators: z.number(),
  }),
  platformFee: z.object({
    total: z.number(),
    today: z.number(),
    last7Days: z.number(),
    roundsToday: z.number(),
  }),
  coins: z.object({
    // Sum of all user wallets.
    inWallets: z.number(),
    inRoomBanks: z.number(),
    inEscrow: z.number(),
    // Bonuses issued so far (sign-up + daily) and admin adjustments net.
    bonusesIssued: z.number(),
    adjustmentsNet: z.number(),
  }),
  users: z.object({
    total: z.number(),
    signedUpToday: z.number(),
    betToday: z.number(),
    frozenOrBanned: z.number(),
  }),
  // Platform fee per Kathmandu day, newest first.
  feeByDay: z.array(z.object({ date: z.string(), rounds: z.number(), fee: z.number() })),
})

export const adminTopBalancesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
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
