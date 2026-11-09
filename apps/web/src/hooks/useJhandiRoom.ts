import type { GameSymbol } from '@jhandi/game-rules/symbols'
import {
  chatBroadcastSchema,
  myBetsMessageSchema,
  reactionBroadcastSchema,
  soundReactionBroadcastSchema,
  roomClosedMessageSchema,
  roomErrorMessageSchema,
  roomSnapshotSchema,
  roundSettledMessageSchema,
  txFeedMessageSchema,
  walletMessageSchema,
  ROOM_CLIENT_MESSAGES as OUT,
  ROOM_CLOSE_CODES,
  ROOM_SERVER_MESSAGES as IN,
  type REACTIONS,
  type SoundReaction,
} from '@jhandi/protocol/room'
import type { Room } from '@colyseus/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import type { z } from 'zod'
import { gameClient } from '@/lib/gameClient'
import { useRoomStore } from '@/lib/roomStore'
import { reactionSfx } from '@/lib/sound'
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

    // Matchmaking and the WebSocket connect can fail transiently (seat reservation expired on a
    // slow network, server restarting/waking): retry a few times before giving up.
    const joinWithRetry = async (accessToken: string): Promise<Room> => {
      let attempt = 0
      for (;;) {
        try {
          return await gameClient.joinOrCreate('jhandi', { dbRoomId, accessToken })
        } catch (error) {
          attempt += 1
          const message = error instanceof Error ? error.message : String(error)
          const transient = /reservation|expired|timeout|network|failed to fetch|502|503/i.test(
            message,
          )
          if (cancelled || attempt >= 4 || !transient) throw error
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
        }
      }
    }

    const connect = async () => {
      const accessToken = await getValidAccessToken()
      if (!accessToken) throw new Error('Please sign in again')
      const room = await joinWithRetry(accessToken)
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
      on(room, IN.soundReaction, soundReactionBroadcastSchema, ({ displayName, sound }) => {
        reactionSfx(sound)
        s.pushSoundReaction(displayName, sound)
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
      // Handlers of a room object we already replaced must stay silent.
      const isCurrent = () => !cancelled && roomRef.current === room
      // The SDK first tries to resume the same session (bets and seat intact); keep that short
      // (about 10 s) and inside the server's 60 s window, then fall back to a fresh join.
      room.reconnection.maxRetries = 6
      room.onDrop(() => {
        if (isCurrent()) s.set({ connection: 'reconnecting' })
      })
      room.onReconnect(() => {
        if (isCurrent()) s.set({ connection: 'connected' })
      })
      room.onLeave((code: number) => {
        if (!isCurrent()) return
        if (code === ROOM_CLOSE_CODES.removedByHost || code === ROOM_CLOSE_CODES.openedElsewhere) {
          s.set({
            connection: 'closed',
            connectionError:
              code === ROOM_CLOSE_CODES.removedByHost ? 'REMOVED' : 'OPENED_ELSEWHERE',
          })
          return
        }
        // 1000 / 4000 = we (or the server, politely) closed it on purpose.
        if (code === 1000 || code === 4000) {
          s.set({ connection: 'closed', connectionError: null })
          return
        }
        // Anything else — resume failed, server restarted or slept, signal lost — is not the
        // player's doing: quietly take a fresh seat in the same room.
        rejoin()
      })
      // Socket errors are never final here: a drop is followed by the SDK's resume attempts and,
      // if those fail, by onLeave (verified against the SDK), which takes a fresh seat. Showing
      // the raw error ("seat reservation expired") would only alarm the player.
      room.onError(() => undefined)
    }

    let rejoining = false
    const rejoin = () => {
      if (cancelled || rejoining) return
      rejoining = true
      roomRef.current = null
      store.set({ connection: 'reconnecting' })
      connect()
        .catch((error: unknown) => {
          if (cancelled) return
          useRoomStore.getState().set({
            connection: 'error',
            connectionError: error instanceof Error ? error.message : 'Could not rejoin the room',
          })
        })
        .finally(() => {
          rejoining = false
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
    playSound: (sound: SoundReaction) => {
      send(OUT.soundReaction, { sound })
    },
    lockRoom: () => {
      send(OUT.hostLockRoom)
    },
    unlockRoom: () => {
      send(OUT.hostUnlockRoom)
    },
    removeMember: (userId: string) => {
      send(OUT.hostRemoveMember, { userId })
    },
  }
}

export type RoomActions = ReturnType<typeof useJhandiRoom>
