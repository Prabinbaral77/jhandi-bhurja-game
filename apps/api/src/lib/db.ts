import { createDb } from '@jhandi/db/client'
import { env } from '#lib/env'

export const { db, sql } = createDb({
  databaseUrl: env.DATABASE_URL,
  poolMax: env.DATABASE_POOL_MAX,
})
