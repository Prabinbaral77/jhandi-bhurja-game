import { boolean, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'

export const userStatus = jhandiSchema.enum('user_status', ['ACTIVE', 'FROZEN', 'BANNED'])
export const authProvider = jhandiSchema.enum('auth_provider', ['PHONE', 'GOOGLE'])

export const users = jhandiSchema.table('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  status: userStatus('status').notNull().default('ACTIVE'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const authIdentities = jhandiSchema.table(
  'auth_identities',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: authProvider('provider').notNull(),
    // +97798XXXXXXXX for PHONE, Google `sub` for GOOGLE.
    subject: text('subject').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.provider, t.subject), index().on(t.userId)],
)

export const refreshTokens = jhandiSchema.table(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
)

// One row per OTP sent; only the hash of the code is stored.
export const otpCodes = jhandiSchema.table(
  'otp_codes',
  {
    id: uuid('id').primaryKey(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.phone, t.createdAt.desc())],
)

export type User = typeof users.$inferSelect
