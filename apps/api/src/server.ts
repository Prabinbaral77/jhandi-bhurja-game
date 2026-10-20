import { createExpressMiddleware } from '@trpc/server/adapters/express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { appRouter } from '#controllers/appRouter'
import { sql } from '#lib/db'
import { env } from '#lib/env'
import { logger } from '#lib/logger'
import { redis } from '#lib/redis'
import { createContext } from '#lib/trpc'

const app = express()
app.disable('x-powered-by')
// Behind one reverse proxy in production; makes req.ip the real client IP for rate limits.
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false)
app.use(cookieParser())
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }))

app.use(
  '/v1/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
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
