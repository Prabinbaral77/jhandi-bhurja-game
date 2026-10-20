import { sql } from '#lib/db'
import { redis } from '#lib/redis'
import { withTimeout } from '#utils/withTimeout'

// A cold TLS connection to a far cloud region can take 3 s+; warm pings are much faster.
const PING_TIMEOUT_MS = 5_000

export const pingDatabase = async (): Promise<void> => {
  await withTimeout(sql`select 1`, PING_TIMEOUT_MS, 'postgres ping')
}

export const isRedisConfigured = (): boolean => redis !== null

export const pingRedis = async (): Promise<void> => {
  if (!redis) throw new Error('Redis is not configured')
  if (redis.status === 'wait') await withTimeout(redis.connect(), PING_TIMEOUT_MS, 'redis connect')
  await withTimeout(redis.ping(), PING_TIMEOUT_MS, 'redis ping')
}
