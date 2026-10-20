import type { AppErrorShape } from '@jhandi/protocol/errors'
import type { Client, Room } from '@colyseus/core'
import { z } from 'zod'

// Colyseus' built-in schema validation drops the client on bad input. We reply with the
// shared error shape instead (docs/api-protocol.md §3.3) and keep the connection open.
export const onValidatedMessage = <C extends Client, T>(
  room: Pick<Room<{ client: C }>, 'onMessage'>,
  type: string,
  schema: z.ZodType<T>,
  handler: (client: C, message: T) => void,
): void => {
  room.onMessage(type, (client: C, raw: unknown) => {
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
