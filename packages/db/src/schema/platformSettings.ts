import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'
import { users } from '#schema/users'

// docs/database.md — admin-editable numbers (bonuses, deposit, fee, limits).
export const platformSettings = jhandiSchema.table('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
