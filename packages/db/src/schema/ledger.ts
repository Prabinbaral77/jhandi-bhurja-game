import { sql } from 'drizzle-orm'
import { bigint, bigserial, check, index, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { jhandiSchema } from '#schema/jhandiSchema'

export const accountType = jhandiSchema.enum('account_type', [
  'USER',
  'ROOM_BANK',
  'ROUND_ESCROW',
  'SYSTEM',
])

export const transactionKind = jhandiSchema.enum('transaction_kind', [
  'SIGNUP_BONUS',
  'DAILY_BONUS',
  'HOST_DEPOSIT',
  'BANK_TOPUP',
  'BET',
  'BET_CANCEL',
  'SETTLE',
  'PLATFORM_FEE',
  'ROOM_CLOSE',
  'ADJUSTMENT',
])

// docs/architecture.md §5.4 — double-entry ledger. Coins are bigint, read as JS numbers.
export const accounts = jhandiSchema.table(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    type: accountType('type').notNull(),
    // user / room / round id; NULL for SYSTEM accounts.
    ownerId: uuid('owner_id'),
    // SYSTEM accounts only: BONUS | PLATFORM_FEE | ADJUSTMENT.
    code: text('code').unique(),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.type, t.ownerId),
    // SYSTEM:BONUS goes negative: its balance is minus the coins ever issued.
    check('accounts_balance_non_negative', sql`${t.type} = 'SYSTEM' OR ${t.balance} >= 0`),
  ],
)

export const transactions = jhandiSchema.table(
  'transactions',
  {
    id: uuid('id').primaryKey(),
    kind: transactionKind('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.refType, t.refId)],
)

export const ledgerEntries = jhandiSchema.table(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    // + credit, − debit. Entries of one transaction sum to 0.
    amount: bigint('amount', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.accountId, t.createdAt.desc()), index().on(t.transactionId)],
)
