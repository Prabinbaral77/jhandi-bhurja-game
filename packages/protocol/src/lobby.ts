import { z } from 'zod'
import { ROOM_PHASES } from '#room'

const symbolSchema = z.enum(['CROWN', 'FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB'])

// Colyseus room metadata of a live JhandiRoom; the lobby forwards it to every lobby client
// (docs/architecture.md §5.3). `dbRoomId` doubles as the matchmaking filter key and must
// always be present.
export const roomLiveSummarySchema = z.object({
  dbRoomId: z.string(),
  name: z.string(),
  hostId: z.string(),
  hostName: z.string(),
  phase: z.enum(ROOM_PHASES),
  roundNo: z.number(),
  players: z.number(),
  spectators: z.number(),
  bankBalance: z.number(),
  minBet: z.number(),
  maxBetPerSymbol: z.number(),
  // Last 5 rolls, newest first, each as 6 symbols.
  lastResults: z.array(z.array(symbolSchema)),
  // Coins bet in this room over the last 10 minutes.
  volumeLast10Min: z.number(),
  updatedAt: z.number(),
})

export type RoomLiveSummary = z.infer<typeof roomLiveSummarySchema>

// Shape of each entry the Colyseus LobbyRoom sends (`rooms`, `+`); we only read these fields.
export const lobbyListingSchema = z.object({
  roomId: z.string(),
  clients: z.number(),
  metadata: roomLiveSummarySchema.optional(),
})

export type LobbyListing = z.infer<typeof lobbyListingSchema>

// Global "big win" ticker shown in the lobby.
export const tickerItemSchema = z.object({
  id: z.string(),
  dbRoomId: z.string(),
  roomName: z.string(),
  displayName: z.string(),
  symbol: symbolSchema,
  matches: z.number(),
  won: z.number(),
  at: z.number(),
})

export type TickerItem = z.infer<typeof tickerItemSchema>

export const LOBBY_MESSAGES = {
  rooms: 'rooms',
  added: '+',
  removed: '-',
  ticker: 'ticker',
} as const

// Wins at or above this many coins go to the global ticker.
export const TICKER_MIN_WIN = 200
export const TICKER_HISTORY = 20
