import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'

// docs/database.md — admin-editable numbers (bonuses, deposit, fee, limits).
export const platformSettings = jhandiSchema.table('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  // FK to users is added in M2 when the users table exists.
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
