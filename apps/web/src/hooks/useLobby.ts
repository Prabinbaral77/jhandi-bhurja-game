import type { Room } from '@colyseus/sdk'
import {
  LOBBY_MESSAGES,
  lobbyListingSchema,
  tickerItemSchema,
  type RoomLiveSummary,
  type TickerItem,
} from '@jhandi/protocol/lobby'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { gameClient } from '@/lib/gameClient'
import { getValidAccessToken } from '@/lib/session'

export interface LobbyState {
  status: 'connecting' | 'connected' | 'error'
  // Live summaries of rooms running on a game server, by DB room id.
  live: Record<string, RoomLiveSummary>
  ticker: TickerItem[]
}

const TICKER_MAX = 20

// Streams every live room's summary and the big-win ticker from the Colyseus lobby room.
export const useLobby = (): LobbyState => {
  const [state, setState] = useState<LobbyState>({ status: 'connecting', live: {}, ticker: [] })

  useEffect(() => {
    let cancelled = false
    let joined: Room | null = null
    // Colyseus room id → DB room id, so `-` messages can remove the right entry.
    const dbIdByRoomId = new Map<string, string>()

    const upsert = (listing: unknown) => {
      const parsed = lobbyListingSchema.safeParse(listing)
      if (!parsed.success || !parsed.data.metadata) return
      const summary = parsed.data.metadata
      dbIdByRoomId.set(parsed.data.roomId, summary.dbRoomId)
      setState((s) => ({ ...s, live: { ...s.live, [summary.dbRoomId]: summary } }))
    }

    const connect = async () => {
      const accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Please sign in again')
      const room = await gameClient.joinOrCreate('lobby', { accessToken })
      if (cancelled) {
        void room.leave()
        return
      }
      joined = room
      setState((s) => ({ ...s, status: 'connected' }))

      room.onMessage(LOBBY_MESSAGES.rooms, (rooms: unknown) => {
        const live: Record<string, RoomLiveSummary> = {}
        for (const item of z.array(z.unknown()).catch([]).parse(rooms)) {
          const parsed = lobbyListingSchema.safeParse(item)
          if (parsed.success && parsed.data.metadata) {
            dbIdByRoomId.set(parsed.data.roomId, parsed.data.metadata.dbRoomId)
            live[parsed.data.metadata.dbRoomId] = parsed.data.metadata
          }
        }
        setState((s) => ({ ...s, live }))
      })
      room.onMessage(LOBBY_MESSAGES.added, (payload: unknown) => {
        const parsed = z.tuple([z.string(), z.unknown()]).safeParse(payload)
        if (parsed.success) upsert(parsed.data[1])
      })
      room.onMessage(LOBBY_MESSAGES.removed, (roomId: unknown) => {
        const dbRoomId = typeof roomId === 'string' ? dbIdByRoomId.get(roomId) : undefined
        if (!dbRoomId) return
        setState((s) => ({
          ...s,
          live: Object.fromEntries(Object.entries(s.live).filter(([id]) => id !== dbRoomId)),
        }))
      })
      room.onMessage(LOBBY_MESSAGES.ticker, (payload: unknown) => {
        const items = z.array(tickerItemSchema).safeParse(payload)
        if (!items.success) return
        setState((s) => {
          const seen = new Set(s.ticker.map((t) => t.id))
          const fresh = items.data.filter((t) => !seen.has(t.id))
          return { ...s, ticker: [...fresh, ...s.ticker].slice(0, TICKER_MAX) }
        })
      })
      room.onLeave(() => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error' }))
      })
    }

    connect().catch(() => {
      if (!cancelled) setState((s) => ({ ...s, status: 'error' }))
    })
    return () => {
      cancelled = true
      void joined?.leave()
    }
  }, [])

  return state
}
