import { Room, type Client } from 'colyseus'
import { z } from 'zod'
import { logger } from '#lib/logger'
import { onValidatedMessage } from '#utils/onValidatedMessage'

const pingSchema = z.object({ sentAt: z.number() })

// M0 smoke-test room: proves web ↔ game-server WebSocket works. Replaced by JhandiRoom in M3.
export class PingRoom extends Room {
  override maxClients = 50

  override onCreate(): void {
    onValidatedMessage(this, 'ping', pingSchema, (client, message) => {
      client.send('pong', { sentAt: message.sentAt, serverAt: Date.now() })
    })
  }

  override onJoin(client: Client): void {
    logger.debug({ sessionId: client.sessionId, roomId: this.roomId }, 'client joined ping room')
  }
}
