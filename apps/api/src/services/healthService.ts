import type { DependencyStatus, Health } from '@jhandi/protocol/health'
import { logger } from '#lib/logger'
import { SERVICE_VERSION } from '#lib/version'
import { isRedisConfigured, pingDatabase, pingRedis } from '#repositories/healthRepository'

const check = async (name: string, ping: () => Promise<void>): Promise<DependencyStatus> => {
  try {
    await ping()
    return 'up'
  } catch (error) {
    logger.warn({ err: error, dependency: name }, 'health check failed')
    return 'down'
  }
}

export const getHealth = async (): Promise<Health> => {
  const [postgres, redis] = await Promise.all([
    check('postgres', pingDatabase),
    isRedisConfigured() ? check('redis', pingRedis) : Promise.resolve('disabled' as const),
  ])
  return {
    ok: postgres === 'up' && redis !== 'down',
    service: 'api',
    version: SERVICE_VERSION,
    dependencies: { postgres, redis },
  }
}
