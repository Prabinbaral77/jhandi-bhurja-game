import { closeApi, createApiApp, warmUpDatabase } from '#app'
import { env } from '#lib/env'
import { logger } from '#lib/logger'

const server = createApiApp().listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, 'api listening')
})
// Slowloris-style clients: give up on them.
server.headersTimeout = 15_000
server.requestTimeout = 30_000

void warmUpDatabase()

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down')
  server.close(() => {
    void closeApi().then(() => process.exit(0))
  })
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  shutdown('SIGINT')
})
