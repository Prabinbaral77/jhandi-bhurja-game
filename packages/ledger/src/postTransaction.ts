import type { Transaction } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { accounts, ledgerEntries, transactions } from '@jhandi/db/schema/ledger'
import { AppError } from '@jhandi/protocol/appError'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { CHECK_VIOLATION, pgErrorCode } from '#pgError'

export type TransactionKind = (typeof transactions.$inferInsert)['kind']

export interface LedgerEntryInput {
  accountId: string
  // + credit, − debit.
  amount: number
}

export interface PostTransactionInput {
  kind: TransactionKind
  idempotencyKey: string
  refType?: string
  refId?: string
  entries: readonly LedgerEntryInput[]
}

export type PostTransactionResult =
  // New balance of every account the transaction touched.
  | { status: 'posted'; transactionId: string; balances: ReadonlyMap<string, number> }
  | { status: 'duplicate'; transactionId: string }

const assertBalanced = (entries: readonly LedgerEntryInput[]): void => {
  if (entries.length < 2) throw new Error('A transaction needs at least two entries')
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amount) || entry.amount === 0) {
      throw new Error(`Invalid ledger amount ${entry.amount} for ${entry.accountId}`)
    }
  }
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  if (total !== 0) throw new Error(`Ledger entries must sum to 0, got ${total}`)
}

// Net change per account, in id order so concurrent transactions lock rows in the same order.
const netByAccount = (entries: readonly LedgerEntryInput[]): [string, number][] => {
  const net = new Map<string, number>()
  for (const { accountId, amount } of entries)
    net.set(accountId, (net.get(accountId) ?? 0) + amount)
  return [...net.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
}

/**
 * The only way coins move (docs/architecture.md §5.4). Must run inside the caller's DB
 * transaction so a failure anywhere rolls everything back. Re-posting the same
 * idempotency key is a no-op that returns the original transaction.
 */
export const postTransaction = async (
  tx: Transaction,
  input: PostTransactionInput,
): Promise<PostTransactionResult> => {
  assertBalanced(input.entries)

  const [inserted] = await tx
    .insert(transactions)
    .values({
      id: newId(),
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      refType: input.refType,
      refId: input.refId,
    })
    .onConflictDoNothing({ target: transactions.idempotencyKey })
    .returning({ id: transactions.id })

  if (!inserted) {
    const [existing] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.idempotencyKey, input.idempotencyKey))
    if (!existing) throw new Error(`Idempotency key ${input.idempotencyKey} vanished`)
    return { status: 'duplicate', transactionId: existing.id }
  }

  const net = netByAccount(input.entries)
  const ids = net.map(([accountId]) => accountId)
  const balances = new Map<string, number>()
  if (net.length > 0) {
    // Lock rows in id order first so concurrent transactions can't deadlock, then apply every
    // change in one statement (one round trip, however many accounts).
    await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(inArray(accounts.id, ids))
      .orderBy(asc(accounts.id))
      .for('update')
    const delta = sql.join(
      [
        sql`CASE ${accounts.id}`,
        ...net.map(([accountId, amount]) => sql`WHEN ${accountId}::uuid THEN ${amount}::bigint`),
        sql`END`,
      ],
      sql` `,
    )
    let updated
    try {
      updated = await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${delta}`, updatedAt: sql`now()` })
        .where(inArray(accounts.id, ids))
        .returning({ id: accounts.id, balance: accounts.balance })
    } catch (error) {
      if (pgErrorCode(error) === CHECK_VIOLATION) {
        throw new AppError('INSUFFICIENT_BALANCE', 'Not enough coins')
      }
      throw error
    }
    if (updated.length !== ids.length) {
      const missing = ids.filter((id) => !updated.some((row) => row.id === id))
      throw new Error(`Accounts not found: ${missing.join(', ')}`)
    }
    for (const row of updated) balances.set(row.id, row.balance)
  }

  await tx.insert(ledgerEntries).values(
    input.entries.map((entry) => ({
      transactionId: inserted.id,
      accountId: entry.accountId,
      amount: entry.amount,
    })),
  )

  return { status: 'posted', transactionId: inserted.id, balances }
}
