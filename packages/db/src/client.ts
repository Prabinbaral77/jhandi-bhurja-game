import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { schema } from '#schema/all'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export interface DbOptions {
  databaseUrl: string
  poolMax: number
}

export const createDb = ({ databaseUrl, poolMax }: DbOptions) => {
  const url = new URL(databaseUrl)
  const sql = postgres(databaseUrl, {
    max: poolMax,
    connect_timeout: 10,
    // Cloud Postgres (Supabase) needs TLS; a local Postgres usually has none.
    ssl: LOCAL_HOSTS.has(url.hostname) ? false : 'require',
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: url.port !== '6543',
  })
  return { db: drizzle(sql, { schema }), sql }
}
