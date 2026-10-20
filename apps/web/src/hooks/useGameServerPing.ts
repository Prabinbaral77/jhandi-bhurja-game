import { useEffect, useState } from 'react'
import { z } from 'zod'
import { gameClient } from '@/lib/gameClient'

const pongSchema = z.object({ sentAt: z.number(), serverAt: z.number() })

const PING_INTERVAL_MS = 2_000

export type PingStatus =
  | { state: 'connecting' }
  | { state: 'connected'; roundTripMs: number | null }
  | { state: 'error'; message: string }

// M0 smoke test: joins the "ping" room and measures WebSocket round-trip time.
export const useGameServerPing = (): PingStatus => {
  const [status, setStatus] = useState<PingStatus>({ state: 'connecting' })

  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | undefined
    const roomPromise = gameClient.joinOrCreate('ping')

    roomPromise
      .then((room) => {
        if (cancelled) return
        setStatus({ state: 'connected', roundTripMs: null })
        room.onMessage('pong', (payload: unknown) => {
          const pong = pongSchema.safeParse(payload)
          if (pong.success) {
            setStatus({ state: 'connected', roundTripMs: Date.now() - pong.data.sentAt })
          }
        })
        const ping = () => {
          room.send('ping', { sentAt: Date.now() })
        }
        ping()
        interval = setInterval(ping, PING_INTERVAL_MS)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      })

    return () => {
      cancelled = true
      clearInterval(interval)
      void roomPromise.then((room) => room.leave()).catch(() => undefined)
    }
  }, [])

  return status
}
