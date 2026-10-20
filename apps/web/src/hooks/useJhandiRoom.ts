import type { GameSymbol } from '@jhandi/game-rules/symbols'
import {
  chatBroadcastSchema,
  myBetsMessageSchema,
  reactionBroadcastSchema,
  roomClosedMessageSchema,
  roomErrorMessageSchema,
  roomSnapshotSchema,
  roundSettledMessageSchema,
  txFeedMessageSchema,
  walletMessageSchema,
  ROOM_CLIENT_MESSAGES as OUT,
  ROOM_SERVER_MESSAGES as IN,
  type REACTIONS,
} from '@jhandi/protocol/room'
import type { Room } from '@colyseus/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import type { z } from 'zod'
import { gameClient } from '@/lib/gameClient'
import { useRoomStore } from '@/lib/roomStore'
import { getValidAccessToken } from '@/lib/session'
import { useTRPC } from '@/lib/trpc'

// Validate every server message; drop anything that doesn't match the protocol.
const on = <T>(room: Room, type: string, schema: z.ZodType<T>, handler: (payload: T) => void) => {
  room.onMessage(type, (payload: unknown) => {
    const parsed = schema.safeParse(payload)
    if (parsed.success) handler(parsed.data)
  })
}

export const useJhandiRoom = (dbRoomId: string) => {
  const roomRef = useRef<Room | null>(null)
  const seq = useRef(0)
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  useEffect(() => {
    const store = useRoomStore.getState()
    store.reset()
    let cancelled = false
    let joined: Room | null = null

    const connect = async () => {
      const accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Please sign in again')
      const room = await gameClient.joinOrCreate('jhandi', { dbRoomId, accessToken })
      if (cancelled) {
        void room.leave()
        return
      }
      joined = room
      roomRef.current = room
      store.set({ connection: 'connected' })

      room.onStateChange((state: { toJSON: () => unknown }) => {
        const snapshot = roomSnapshotSchema.safeParse(state.toJSON())
        if (snapshot.success) useRoomStore.getState().set({ snapshot: snapshot.data })
      })
      const s = useRoomStore.getState()
      on(room, IN.wallet, walletMessageSchema, ({ balance }) => {
        s.set({ wallet: balance })
      })
      on(room, IN.myBets, myBetsMessageSchema, (myBets) => {
        s.set({ myBets })
      })
      on(room, IN.roundSettled, roundSettledMessageSchema, (result) => {
        s.set({ lastResult: result })
        void queryClient.invalidateQueries({ queryKey: trpc.wallet.pathKey() })
      })
      on(room, IN.txFeed, txFeedMessageSchema, s.pushFeed)
      on(room, IN.chat, chatBroadcastSchema, s.pushChat)
      on(room, IN.reaction, reactionBroadcastSchema, ({ emoji }) => {
        s.pushReaction(emoji)
      })
      on(room, IN.error, roomErrorMessageSchema, ({ code, message }) => {
        s.set({ lastError: { code, message } })
      })
      on(room, IN.roomClosed, roomClosedMessageSchema, ({ reason }) => {
        s.set({ closedReason: reason })
        void queryClient.invalidateQueries({ queryKey: trpc.wallet.pathKey() })
      })
      on(room, IN.betAccepted, roomErrorMessageSchema.pick({ clientSeq: true }), () => {
        s.set({ lastError: null })
      })
      room.onLeave(() => {
        s.set({ connection: 'closed' })
      })
      room.onError((_code: number, message?: string) => {
        s.set({ connection: 'error', connectionError: message ?? null })
      })
    }

    connect().catch((error: unknown) => {
      if (cancelled) return
      useRoomStore.getState().set({
        connection: 'error',
        connectionError: error instanceof Error ? error.message : 'Could not join the room',
      })
    })

    return () => {
      cancelled = true
      roomRef.current = null
      void joined?.leave()
    }
  }, [dbRoomId, queryClient, trpc])

  const send = useCallback((type: string, payload: object = {}) => {
    roomRef.current?.send(type, payload)
  }, [])
  const nextSeq = () => ++seq.current

  return {
    joinAsPlayer: () => {
      send(OUT.joinAsPlayer)
    },
    placeBet: (symbol: GameSymbol, amount: number) => {
      send(OUT.placeBet, { symbol, amount, clientSeq: nextSeq() })
    },
    cancelBet: (symbol: GameSymbol) => {
      send(OUT.cancelBet, { symbol, clientSeq: nextSeq() })
    },
    startRound: () => {
      send(OUT.hostStartRound)
    },
    rollNow: () => {
      send(OUT.hostLockAndRoll)
    },
    pause: () => {
      send(OUT.hostPause)
    },
    closeRoom: () => {
      send(OUT.hostClose)
    },
    topUp: (amount: number) => {
      send(OUT.hostTopUp, { amount, clientSeq: nextSeq() })
    },
    chat: (text: string) => {
      send(OUT.chat, { text })
    },
    react: (emoji: (typeof REACTIONS)[number]) => {
      send(OUT.reaction, { emoji })
    },
  }
}

export type RoomActions = ReturnType<typeof useJhandiRoom>
