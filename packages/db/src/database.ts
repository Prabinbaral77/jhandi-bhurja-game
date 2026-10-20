import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'
import type { schema } from '#schema/all'

type Schema = typeof schema

// Driver-agnostic types so the same code runs on postgres-js (apps) and PGlite (tests).
export type Database = PgDatabase<PgQueryResultHKT, Schema>
export type Transaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>
export type DbOrTx = Database | Transaction
