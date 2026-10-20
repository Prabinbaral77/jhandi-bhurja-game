import { WebSocketTransport } from '@colyseus/ws-transport'
import type { Health } from '@jhandi/protocol/health'
import { defineRoom, defineServer } from 'colyseus'
import { PingRoom } from '#controllers/pingRoom'
import { env } from '#lib/env'
import { logger } from '#lib/logger'

const server = defineServer({
  greet: false,
  transport: new WebSocketTransport(),
  rooms: {
    ping: defineRoom(PingRoom),
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

await server.listen(env.GAME_SERVER_PORT)
logger.info({ port: env.GAME_SERVER_PORT }, 'game-server listening')
