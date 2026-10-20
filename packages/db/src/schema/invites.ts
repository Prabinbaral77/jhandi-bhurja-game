import { sql } from 'drizzle-orm'
import { text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'
import { rooms } from '#schema/rooms'
import { users } from '#schema/users'

// docs/architecture.md §5.6 — one active invite (link token + 6-char code) per private room.
// Only HMAC hashes are stored; the plain values are shown to the host once, at create/reset.
export const roomInvites = jhandiSchema.table(
  'room_invites',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    tokenHash: text('token_hash').notNull().unique(),
    codeHash: text('code_hash').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('room_invites_one_active')
      .on(t.roomId)
      .where(sql`${t.revokedAt} IS NULL`),
    uniqueIndex('room_invites_code_active')
      .on(t.codeHash)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
)
