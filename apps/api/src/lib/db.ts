import { createDb } from '@jhandi/db/client'
import type { Database } from '@jhandi/db/database'
import { env } from '#lib/env'

const client = createDb({ databaseUrl: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX })

export const db: Database = client.db
export const sql = client.sql
