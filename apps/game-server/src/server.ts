import type { Health } from '@jhandi/protocol/health'
import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { JhandiRoom } from '#controllers/jhandiRoom'
import { PingRoom } from '#controllers/pingRoom'
import { sql } from '#lib/db'
import { env } from '#lib/env'
import { logger } from '#lib/logger'
import { voidUnfinishedRounds } from '#services/roundService'
import { assertSingleColyseusCore } from '#utils/assertSingleColyseusCore'

assertSingleColyseusCore()

// Rounds left open by a previous crash are refunded before any room starts.
await voidUnfinishedRounds()

const server = defineServer({
  greet: false,
  transport: new WebSocketTransport(),
  rooms: {
    ping: defineRoom(PingRoom),
    // One Colyseus room per DB room: clients joinOrCreate with the same dbRoomId.
    jhandi: defineRoom(JhandiRoom).filterBy(['dbRoomId']),
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      const health: Health = {
        ok: true,
        service: 'game-server',
        version: process.env.npm_package_version ?? '0.0.0',
        dependencies: {},
      }
      res.json(health)
    })
  },
})

server.onShutdown(async () => {
  await sql.end({ timeout: 5 })
})

await server.listen(env.GAME_SERVER_PORT)
logger.info({ port: env.GAME_SERVER_PORT }, 'game-server listening')
