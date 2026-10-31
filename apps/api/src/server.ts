import { createExpressMiddleware } from '@trpc/server/adapters/express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { appRouter } from '#controllers/appRouter'
import { sql } from '#lib/db'
import { env } from '#lib/env'
import { logger } from '#lib/logger'
import { redis } from '#lib/redis'
import {
  authPathRateLimit,
  globalRateLimit,
  MAX_BODY_BYTES,
  sameOriginOnly,
  securityHeaders,
} from '#lib/security'
import { createContext } from '#lib/trpc'

const app = express()
app.disable('x-powered-by')
// Number of reverse proxies in front of us, so req.ip (rate limits, abuse signals) is the client.
app.set('trust proxy', env.TRUST_PROXY)
app.use(securityHeaders)
app.use(cookieParser())
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true, maxAge: 600 }))
app.use(globalRateLimit)
app.use(authPathRateLimit)
app.use(sameOriginOnly)

app.use(
  '/v1/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    maxBodySize: MAX_BODY_BYTES,
    onError: ({ error, path, ctx }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        logger.error({ err: error, path, requestId: ctx?.requestId }, 'trpc error')
      }
    },
  }),
)

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, 'api listening')
})
// Slowloris-style clients: give up on them.
server.headersTimeout = 15_000
server.requestTimeout = 30_000

// Open the first DB connection at boot so the first user request doesn't pay the TLS handshake.
const warmUpDatabase = async () => {
  const startedAt = Date.now()
  try {
    await sql`select 1`
    logger.info({ ms: Date.now() - startedAt }, 'database connected')
  } catch (error) {
    logger.error({ err: error }, 'database warm-up failed')
  }
}
void warmUpDatabase()

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down')
  server.close(() => {
    void Promise.allSettled([sql.end({ timeout: 5 }), redis?.quit()]).then(() => process.exit(0))
  })
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  shutdown('SIGINT')
})
