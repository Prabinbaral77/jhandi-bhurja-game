import { schema, t, type SchemaType } from '@colyseus/schema'

// Synced to every client in the room (docs/api-protocol.md §3.2). Private data (own bets,
// wallet balance) goes through direct messages instead.
export const MemberState = schema(
  {
    userId: t.string().default(''),
    displayName: t.string().default(''),
    role: t.string().default('SPECTATOR'),
    connected: t.boolean().default(true),
  },
  'Member',
)
export type MemberState = SchemaType<typeof MemberState>

export const SymbolTotalState = schema(
  {
    total: t.number().default(0),
    bettors: t.number().default(0),
  },
  'SymbolTotal',
)
export type SymbolTotalState = SchemaType<typeof SymbolTotalState>

export const JhandiState = schema(
  {
    roomId: t.string().default(''),
    name: t.string().default(''),
    hostId: t.string().default(''),
    phase: t.string().default('OPEN'),
    pausedReason: t.string().default(''),
    roundId: t.string().default(''),
    roundNo: t.number().default(0),
    seedHash: t.string().default(''),
    bettingEndsAt: t.number().default(0),
    bankBalance: t.number().default(0),
    minBet: t.number().default(0),
    maxBetPerSymbol: t.number().default(0),
    maxBetPerPlayerPerRound: t.number().default(0),
    isPrivate: t.boolean().default(false),
    isLocked: t.boolean().default(false),
    venue: t.string().default('NYATAPOLA'),
    members: t.map(MemberState),
    board: t.map(SymbolTotalState),
    lastDice: t.array('string'),
    // Last rolls as comma-joined symbols, newest first.
    history: t.array('string'),
  },
  'JhandiState',
)
export type JhandiState = SchemaType<typeof JhandiState>
