import type { AppErrorShape } from '@jhandi/protocol/errors'
import { ROOM_CLOSE_CODES } from '@jhandi/protocol/room'
import type { Client, Room } from '@colyseus/core'
import { z } from 'zod'

// Per-connection message budget: 20 messages per second, burst of 40. Honest play is far
// below this; a client that keeps flooding is dropped (docs/security.md).
const RATE_PER_SEC = 20
const BURST = 40
const STRIKES_BEFORE_KICK = 50

interface Bucket {
  tokens: number
  updatedAt: number
  strikes: number
}
const buckets = new WeakMap<Client, Bucket>()

const allow = (client: Client): boolean => {
  const now = Date.now()
  const bucket = buckets.get(client) ?? { tokens: BURST, updatedAt: now, strikes: 0 }
  bucket.tokens = Math.min(BURST, bucket.tokens + ((now - bucket.updatedAt) / 1000) * RATE_PER_SEC)
  bucket.updatedAt = now
  buckets.set(client, bucket)
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return true
  }
  bucket.strikes += 1
  if (bucket.strikes >= STRIKES_BEFORE_KICK)
    client.leave(ROOM_CLOSE_CODES.tooManyMessages, 'Too many messages')
  return false
}

// Colyseus' built-in schema validation drops the client on bad input. We reply with the
// shared error shape instead (docs/api-protocol.md §3.3) and keep the connection open.
export const onValidatedMessage = <C extends Client, T>(
  room: Pick<Room<{ client: C }>, 'onMessage'>,
  type: string,
  schema: z.ZodType<T>,
  handler: (client: C, message: T) => void,
): void => {
  room.onMessage(type, (client: C, raw: unknown) => {
    if (!allow(client)) return
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const error: AppErrorShape = {
        code: 'VALIDATION_FAILED',
        message: `Invalid "${type}" message`,
        details: { issues: z.treeifyError(parsed.error) },
      }
      client.send('error', error)
      return
    }
    handler(client, parsed.data)
  })
}
