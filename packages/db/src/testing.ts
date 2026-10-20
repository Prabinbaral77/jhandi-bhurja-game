import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { fileURLToPath } from 'node:url'
import type { Database } from '#database'
import { schema } from '#schema/all'

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url))

// In-process Postgres for tests: real SQL, constraints and migrations, no Docker or cloud DB.
export const createTestDb = async (): Promise<{ db: Database; close: () => Promise<void> }> => {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return { db, close: () => client.close() }
}
