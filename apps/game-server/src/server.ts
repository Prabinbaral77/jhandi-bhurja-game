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
import { closeAbandonedRooms, voidUnfinishedRounds } from '#services/roundService'
import {
  MAX_WS_PAYLOAD_BYTES,
  guardMatchmakeRequests,
  refuseForeignOrigins,
  restrictMatchmakerCors,
} from '#lib/security'
import { assertSingleColyseusCore } from '#utils/assertSingleColyseusCore'

assertSingleColyseusCore()
restrictMatchmakerCors()

// With Redis every node shares one room registry and pub/sub, so the lobby lists rooms from all
// nodes and a client is routed to the node that owns its room. Without it, one node only.
const shared = env.REDIS_URL !== undefined
const server = defineServer({
  greet: false,
  transport: new WebSocketTransport({
    beforeUpgrade: refuseForeignOrigins,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
    // Colyseus drops a client that misses 2 pings 3 s apart (~6 s). A phone on mobile data
    // stalls longer than that all the time, which showed up as constant "reconnecting". Allow
    // about 40 s of silence before giving up on a socket.
    pingInterval: 8_000,
    pingMaxRetries: 5,
  }),
  presence: shared ? new RedisPresence(env.REDIS_URL) : new LocalPresence(),
  driver: shared ? new RedisDriver(env.REDIS_URL) : new LocalDriver(),
  rooms: {
    ping: defineRoom(PingRoom),
    lobby: defineRoom(JhandiLobbyRoom),
    // One Colyseus room per DB room: clients joinOrCreate with the same dbRoomId.
    jhandi: defineRoom(JhandiRoom).filterBy(['dbRoomId']).enableRealtimeListing(),
  },
  express: async (app) => {
    app.disable('x-powered-by')
    app.set('trust proxy', env.TRUST_PROXY)
    if (env.SERVE_API) {
      // Same process serves the API: free single-service hosting (docs/deploy.md §0c).
      const api = await import('@jhandi/api/app')
      app.use(api.createApiApp())
      void api.warmUpDatabase()
    }
    app.get('/health', (_req, res) => {
      const health: Health = {
        ok: true,
        service: 'game-server',
        version: process.env.npm_package_version ?? '0.0.0',
        dependencies: { redis: shared ? 'up' : 'disabled' },
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      }
      res.json(health)
    })
  },
})

server.onShutdown(async () => {
  await sql.end({ timeout: 5 })
  if (env.SERVE_API) await (await import('@jhandi/api/app')).closeApi()
})

await server.listen(env.GAME_SERVER_PORT)
if (server.transport.server) guardMatchmakeRequests(server.transport.server)
// After listen: the matchmaker is booted, so other nodes' rooms are visible in the registry.
// Rounds left open by a crashed node are refunded; rooms stay OPEN for their host unless they
// have been idle for hours (ABANDONED_AFTER_MS); rooms live on another node are untouched.
await voidUnfinishedRounds(isRoomLive)
const closedAbandoned = await closeAbandonedRooms(isRoomLive)
// Keep sweeping: a room nobody has touched for hours gives its bank back to the host.
const SWEEP_MS = 15 * 60 * 1000
const sweep = setInterval(() => {
  closeAbandonedRooms(isRoomLive).catch((error: unknown) => {
    logger.error({ err: error }, 'abandoned-room sweep failed')
  })
}, SWEEP_MS)
sweep.unref()
logger.info({ port: env.GAME_SERVER_PORT, shared, closedAbandoned }, 'game-server listening')
