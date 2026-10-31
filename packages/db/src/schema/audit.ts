import { bigserial, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'
import { users } from '#schema/users'

// docs/architecture.md §10 — every admin and sensitive action, append-only.
export const auditLog = jhandiSchema.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    // e.g. "user:<id>", "room:<id>", "settings:<key>"
    target: text('target'),
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt.desc()), index().on(t.target)],
)
