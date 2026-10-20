import { defineRoom, defineServer, LocalDriver, LocalPresence } from '@colyseus/core'
import { RedisDriver } from '@colyseus/redis-driver'
import { RedisPresence } from '@colyseus/redis-presence'
import { WebSocketTransport } from '@colyseus/ws-transport'
import type { Health } from '@jhandi/protocol/health'
import { JhandiRoom } from '#controllers/jhandiRoom'
import { JhandiLobbyRoom } from '#controllers/lobbyRoom'
import { PingRoom } from '#controllers/pingRoom'
import { sql } from '#lib/db'
import { env } from '#lib/env'
import { logger } from '#lib/logger'
import { isRoomLive } from '#lib/roomRegistry'
import { voidUnfinishedRounds } from '#services/roundService'
import { assertSingleColyseusCore } from '#utils/assertSingleColyseusCore'

assertSingleColyseusCore()

// With Redis every node shares one room registry and pub/sub, so the lobby lists rooms from all
// nodes and a client is routed to the node that owns its room. Without it, one node only.
const shared = env.REDIS_URL !== undefined
const server = defineServer({
  greet: false,
  transport: new WebSocketTransport(),
  presence: shared ? new RedisPresence(env.REDIS_URL) : new LocalPresence(),
  driver: shared ? new RedisDriver(env.REDIS_URL) : new LocalDriver(),
  rooms: {
    ping: defineRoom(PingRoom),
    lobby: defineRoom(JhandiLobbyRoom),
    // One Colyseus room per DB room: clients joinOrCreate with the same dbRoomId.
    jhandi: defineRoom(JhandiRoom).filterBy(['dbRoomId']).enableRealtimeListing(),
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      const health: Health = {
        ok: true,
        service: 'game-server',
        version: process.env.npm_package_version ?? '0.0.0',
        dependencies: { redis: shared ? 'up' : 'disabled' },
      }
      res.json(health)
    })
  },
})

server.onShutdown(async () => {
  await sql.end({ timeout: 5 })
})

await server.listen(env.GAME_SERVER_PORT)
// After listen: the matchmaker is booted, so other nodes' rooms are visible in the registry.
// Rounds left open by a crashed node are refunded; rounds of live rooms are kept.
await voidUnfinishedRounds(isRoomLive)
logger.info({ port: env.GAME_SERVER_PORT, shared }, 'game-server listening')
