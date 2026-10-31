import { redis } from '#lib/redis'
import { logger } from '#lib/logger'

/**
 * Small read-through cache. With REDIS_URL set, values are shared by every API node and an
 * invalidation is seen everywhere at once; without it, a per-process map with the same TTL.
 * Redis trouble never fails a request: the loader runs and the result is served uncached.
 */

const memory = new Map<string, { value: unknown; expiresAt: number }>()
const PREFIX = 'jb:cache:'

const readMemory = (key: string): unknown => {
  const hit = memory.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key)
    return undefined
  }
  return hit.value
}

const writeMemory = (key: string, value: unknown, ttlSec: number): void => {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
  if (memory.size > 5_000) {
    const now = Date.now()
    for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k)
  }
}

export const cached = async <T>(
  key: string,
  ttlSec: number,
  load: () => Promise<T>,
): Promise<T> => {
  if (!redis) {
    const hit = readMemory(key)
    if (hit !== undefined) return hit as T
    const value = await load()
    writeMemory(key, value, ttlSec)
    return value
  }
  try {
    const raw = await redis.get(PREFIX + key)
    if (raw !== null) return JSON.parse(raw) as T
  } catch (error) {
    logger.warn({ err: error, key }, 'cache read failed; loading uncached')
  }
  const value = await load()
  redis.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSec).catch((error: unknown) => {
    logger.warn({ err: error, key }, 'cache write failed')
  })
  return value
}

export const invalidate = async (key: string): Promise<void> => {
  memory.delete(key)
  if (!redis) return
  try {
    await redis.del(PREFIX + key)
  } catch (error) {
    logger.warn({ err: error, key }, 'cache invalidate failed')
  }
}
