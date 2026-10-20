import { sql } from 'drizzle-orm'
import { bigint, date, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'
import { users } from '#schema/users'

export const bonusKind = jhandiSchema.enum('bonus_kind', ['SIGNUP', 'DAILY'])

export const bonuses = jhandiSchema.table(
  'bonuses',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: bonusKind('kind').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    // Calendar day in Asia/Kathmandu.
    bonusDate: date('bonus_date', { mode: 'string' }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bonuses_signup_once')
      .on(t.userId)
      .where(sql`${t.kind} = 'SIGNUP'`),
    uniqueIndex('bonuses_daily_once')
      .on(t.userId, t.bonusDate)
      .where(sql`${t.kind} = 'DAILY'`),
  ],
)
