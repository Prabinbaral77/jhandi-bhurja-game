import { z } from 'zod'
import { appErrorShapeSchema } from '#errors'

// Kept in sync with packages/game-rules/src/symbols.ts (protocol can't depend on game-rules).
const symbolSchema = z.enum(['CROWN', 'FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB'])

export const ROOM_PHASES = [
  'OPEN',
  'BETTING',
  'LOCKED',
  'ROLLING',
  'SETTLING',
  'RESULT',
  'PAUSED',
  'CLOSED',
] as const
export type RoomPhase = (typeof ROOM_PHASES)[number]

// ---------- API (tRPC) ----------

export const createRoomInputSchema = z.object({
  name: z.string().trim().min(3).max(40),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  deposit: z.number().int().positive(),
  limits: z
    .object({
      minBet: z.number().int().optional(),
      maxBetPerSymbol: z.number().int().optional(),
      maxBetPerPlayerPerRound: z.number().int().optional(),
      bettingWindowSec: z.number().int().optional(),
    })
    .default({}),
})

// Shown to the host once (create / reset); only hashes are kept server-side.
export const inviteSchema = z.object({ inviteLink: z.string(), roomCode: z.string() })

export type Invite = z.infer<typeof inviteSchema>

export const createRoomOutputSchema = z.object({
  roomId: z.string(),
  invite: inviteSchema.optional(),
})

// Room code: 6 chars, no 0/O/1/I/L (docs/architecture.md §5.6).
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 6
export const roomCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .length(ROOM_CODE_LENGTH)
      .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`)),
  )

export const invitePreviewSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  host: z.object({ id: z.string(), displayName: z.string() }),
  members: z.number(),
  maxMembers: z.number(),
  // True once the caller has access (host or accepted invite).
  joined: z.boolean(),
})

export type InvitePreview = z.infer<typeof invitePreviewSchema>

export const roomSummarySchema = z.object({
  roomId: z.string(),
  name: z.string(),
  host: z.object({ id: z.string(), displayName: z.string() }),
  status: z.enum(['OPEN', 'PAUSED', 'CLOSED']),
  minBet: z.number(),
  maxBetPerSymbol: z.number(),
  createdAt: z.number(),
})

export type RoomSummary = z.infer<typeof roomSummarySchema>

// ---------- Realtime: client → server ----------

export const ROOM_CLIENT_MESSAGES = {
  joinAsPlayer: 'join_as_player',
  placeBet: 'place_bet',
  cancelBet: 'cancel_bet',
  hostStartRound: 'host_start_round',
  hostLockAndRoll: 'host_lock_and_roll',
  hostPause: 'host_pause',
  hostClose: 'host_close',
  hostTopUp: 'host_top_up_bank',
  hostLockRoom: 'host_lock_room',
  hostUnlockRoom: 'host_unlock_room',
  hostRemoveMember: 'host_remove_member',
  chat: 'chat',
  reaction: 'reaction',
} as const

export const clientSeqSchema = z.number().int().nonnegative()

export const placeBetMessageSchema = z.object({
  symbol: symbolSchema,
  amount: z.number().int().positive(),
  clientSeq: clientSeqSchema,
})

export const cancelBetMessageSchema = z.object({ symbol: symbolSchema, clientSeq: clientSeqSchema })

export const topUpMessageSchema = z.object({
  amount: z.number().int().positive(),
  clientSeq: clientSeqSchema,
})

export const emptyMessageSchema = z.object({}).optional()

export const removeMemberMessageSchema = z.object({ userId: z.string().min(1) })

export const chatMessageSchema = z.object({ text: z.string().trim().min(1).max(200) })

export const REACTIONS = ['🎉', '🙏', '😮', '😂', '🔥', '🪁'] as const
export const reactionMessageSchema = z.object({ emoji: z.enum(REACTIONS) })

// ---------- Realtime: server → client ----------

export const ROOM_SERVER_MESSAGES = {
  wallet: 'wallet',
  myBets: 'my_bets',
  betAccepted: 'bet_accepted',
  error: 'error',
  roundSettled: 'round_settled',
  txFeed: 'tx_feed',
  chat: 'chat',
  reaction: 'reaction',
  roomClosed: 'room_closed',
  memberRemoved: 'member_removed',
} as const

export const memberRemovedMessageSchema = z.object({ userId: z.string() })

export const walletMessageSchema = z.object({ balance: z.number() })

export const myBetsMessageSchema = z.object({
  roundId: z.string(),
  bets: z.partialRecord(symbolSchema, z.number()),
})

export const roomErrorMessageSchema = appErrorShapeSchema.extend({
  clientSeq: z.number().optional(),
})

export const roundSettledMessageSchema = z.object({
  roundId: z.string(),
  roundNo: z.number(),
  dice: z.array(symbolSchema).length(6),
  seedHash: z.string(),
  serverSeed: z.string(),
  winners: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      symbol: symbolSchema,
      won: z.number(),
    }),
  ),
  hostNet: z.number(),
  platformFee: z.number(),
  bankAfter: z.number(),
  // This client's own result for the round (0 if no bets).
  yourNet: z.number(),
})

export type RoundSettledMessage = z.infer<typeof roundSettledMessageSchema>

export const txFeedMessageSchema = z.object({
  type: z.enum(['BET', 'CANCEL', 'WIN', 'BANK_TOPUP']),
  displayName: z.string(),
  symbol: symbolSchema.optional(),
  amount: z.number(),
  at: z.number(),
})

export type TxFeedMessage = z.infer<typeof txFeedMessageSchema>

export const chatBroadcastSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  text: z.string(),
  at: z.number(),
})

export const reactionBroadcastSchema = z.object({
  userId: z.string(),
  emoji: z.enum(REACTIONS),
})

export const roomClosedMessageSchema = z.object({ reason: z.string() })

// Shape of the synced Colyseus state after `state.toJSON()` on the client.
export const roomSnapshotSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  hostId: z.string(),
  phase: z.enum(ROOM_PHASES),
  pausedReason: z.string(),
  roundId: z.string(),
  roundNo: z.number(),
  seedHash: z.string(),
  bettingEndsAt: z.number(),
  bankBalance: z.number(),
  minBet: z.number(),
  maxBetPerSymbol: z.number(),
  maxBetPerPlayerPerRound: z.number(),
  isPrivate: z.boolean(),
  isLocked: z.boolean(),
  members: z.record(
    z.string(),
    z.object({
      userId: z.string(),
      displayName: z.string(),
      role: z.enum(['HOST', 'PLAYER', 'SPECTATOR']),
      connected: z.boolean(),
    }),
  ),
  board: z.partialRecord(symbolSchema, z.object({ total: z.number(), bettors: z.number() })),
  lastDice: z.array(symbolSchema),
  history: z.array(z.string()),
})

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>
