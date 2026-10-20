import type { GameSymbol } from '@jhandi/game-rules/symbols'
import type { RoomSnapshot, RoundSettledMessage, TxFeedMessage } from '@jhandi/protocol/room'
import { create } from 'zustand'

export interface ChatLine {
  userId: string
  displayName: string
  text: string
  at: number
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

interface RoomStore {
  connection: ConnectionStatus
  connectionError: string | null
  snapshot: RoomSnapshot | null
  wallet: number | null
  myBets: { roundId: string; bets: Partial<Record<GameSymbol, number>> } | null
  lastResult: RoundSettledMessage | null
  feed: TxFeedMessage[]
  chat: ChatLine[]
  reactions: { id: number; emoji: string }[]
  lastError: { code: string; message: string } | null
  closedReason: string | null
  reset: () => void
  set: (partial: Partial<Omit<RoomStore, 'reset' | 'set'>>) => void
  pushFeed: (entry: TxFeedMessage) => void
  pushChat: (line: ChatLine) => void
  pushReaction: (emoji: string) => void
}

const FEED_LIMIT = 30
const CHAT_LIMIT = 50
let reactionId = 0

const initial = {
  connection: 'connecting' as ConnectionStatus,
  connectionError: null,
  snapshot: null,
  wallet: null,
  myBets: null,
  lastResult: null,
  feed: [],
  chat: [],
  reactions: [],
  lastError: null,
  closedReason: null,
}

// Live state of the room the user is in, fed by the Colyseus connection.
export const useRoomStore = create<RoomStore>((set) => ({
  ...initial,
  reset: () => {
    set(initial)
  },
  set: (partial) => {
    set(partial)
  },
  pushFeed: (entry) => {
    set((s) => ({ feed: [entry, ...s.feed].slice(0, FEED_LIMIT) }))
  },
  pushChat: (line) => {
    set((s) => ({ chat: [...s.chat, line].slice(-CHAT_LIMIT) }))
  },
  pushReaction: (emoji) => {
    const id = ++reactionId
    set((s) => ({ reactions: [...s.reactions, { id, emoji }] }))
    setTimeout(() => {
      set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }))
    }, 2_500)
  },
}))
