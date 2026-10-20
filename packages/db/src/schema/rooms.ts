import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'
import { users } from '#schema/users'

export const roomVisibility = jhandiSchema.enum('room_visibility', ['PUBLIC', 'PRIVATE'])
export const roomStatus = jhandiSchema.enum('room_status', ['OPEN', 'PAUSED', 'CLOSED'])
export const memberRole = jhandiSchema.enum('member_role', ['HOST', 'PLAYER', 'SPECTATOR'])
export const roundStatus = jhandiSchema.enum('round_status', [
  'BETTING',
  'LOCKED',
  'SETTLED',
  'VOIDED',
])
export const betStatus = jhandiSchema.enum('bet_status', [
  'PLACED',
  'CANCELLED',
  'WON',
  'LOST',
  'REFUNDED',
])

export const rooms = jhandiSchema.table(
  'rooms',
  {
    id: uuid('id').primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    visibility: roomVisibility('visibility').notNull().default('PUBLIC'),
    venue: text('venue').notNull(),
    // Room limits and timings (packages/game-rules/src/limits.ts).
    config: jsonb('config').notNull(),
    status: roomStatus('status').notNull().default('OPEN'),
    isLocked: boolean('is_locked').notNull().default(false),
    maxMembers: integer('max_members'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index().on(t.status, t.visibility),
    // A host runs at most one room at a time.
    uniqueIndex('rooms_one_active_per_host')
      .on(t.hostId)
      .where(sql`${t.status} <> 'CLOSED'`),
  ],
)

export const roomMembers = jhandiSchema.table(
  'room_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRole('role').notNull(),
    access: text('access').notNull().default('PUBLIC'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.userId] })],
)

export const rounds = jhandiSchema.table(
  'rounds',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    roundNo: integer('round_no').notNull(),
    status: roundStatus('status').notNull().default('BETTING'),
    seedHash: text('seed_hash').notNull(),
    // Written only after settlement (commit–reveal).
    serverSeed: text('server_seed'),
    dice: smallint('dice').array(),
    losingStakes: bigint('losing_stakes', { mode: 'number' }),
    winningsPaid: bigint('winnings_paid', { mode: 'number' }),
    platformFee: bigint('platform_fee', { mode: 'number' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.roomId, t.roundNo), index().on(t.status)],
)

export const bets = jhandiSchema.table(
  'bets',
  {
    id: uuid('id').primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    symbol: text('symbol').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: betStatus('status').notNull().default('PLACED'),
    // Stake returned + winnings, set at settlement.
    payout: bigint('payout', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.roundId, t.userId, t.symbol), index().on(t.userId, t.createdAt.desc())],
)
