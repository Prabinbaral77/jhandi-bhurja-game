import { createExpressMiddleware } from '@trpc/server/adapters/express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
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

/**
 * The API as an Express app, without a listener. `server.ts` listens on its own port; the game
 * server can mount the same app (SERVE_API=true) so one free host runs both (docs/deploy.md).
 */
export const createApiApp = (): Express => {
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
  return app
}

// Open the first DB connection at boot so the first user request doesn't pay the TLS handshake.
export const warmUpDatabase = async (): Promise<void> => {
  const startedAt = Date.now()
  try {
    await sql`select 1`
    logger.info({ ms: Date.now() - startedAt }, 'database connected')
  } catch (error) {
    logger.error({ err: error }, 'database warm-up failed')
  }
}

export const closeApi = async (): Promise<void> => {
  await Promise.allSettled([sql.end({ timeout: 5 }), redis?.quit()])
}
