import { accounts } from '@jhandi/db/schema/ledger'
import type { DbOrTx } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { and, eq } from 'drizzle-orm'

// Account kinds of the double-entry ledger (docs/architecture.md §5.4).
export const ACCOUNT_TYPES = ['USER', 'ROOM_BANK', 'ROUND_ESCROW', 'SYSTEM'] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const SYSTEM_ACCOUNTS = ['BONUS', 'PLATFORM_FEE', 'ADJUSTMENT'] as const

export type SystemAccount = (typeof SYSTEM_ACCOUNTS)[number]

type OwnedAccountType = Exclude<AccountType, 'SYSTEM'>

// Idempotent: returns the existing account if one is already there.
export const getOrCreateAccount = async (
  db: DbOrTx,
  type: OwnedAccountType,
  ownerId: string,
): Promise<string> => {
  await db.insert(accounts).values({ id: newId(), type, ownerId }).onConflictDoNothing()
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.type, type), eq(accounts.ownerId, ownerId)))
  if (!row) throw new Error(`Account ${type}:${ownerId} missing after insert`)
  return row.id
}

export const findAccountId = async (
  db: DbOrTx,
  type: OwnedAccountType,
  ownerId: string,
): Promise<string | undefined> => {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.type, type), eq(accounts.ownerId, ownerId)))
  return row?.id
}

export const getBalance = async (db: DbOrTx, accountId: string): Promise<number> => {
  const [row] = await db
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  if (!row) throw new Error(`Account ${accountId} not found`)
  return row.balance
}
