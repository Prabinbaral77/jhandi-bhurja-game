import { Redis } from 'ioredis'
import { env } from '#lib/env'

// null when REDIS_URL is not set; callers must handle running without Redis.
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { connectTimeout: 5_000, maxRetriesPerRequest: 2, lazyConnect: true })
  : null
