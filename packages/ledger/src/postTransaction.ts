import type { Transaction } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { accounts, ledgerEntries, transactions } from '@jhandi/db/schema/ledger'
import { AppError } from '@jhandi/protocol/appError'
import { eq, sql } from 'drizzle-orm'
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
  { status: 'posted'; transactionId: string } | { status: 'duplicate'; transactionId: string }

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

  for (const [accountId, amount] of netByAccount(input.entries)) {
    try {
      const updated = await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amount}`, updatedAt: sql`now()` })
        .where(eq(accounts.id, accountId))
        .returning({ id: accounts.id })
      if (updated.length === 0) throw new Error(`Account ${accountId} not found`)
    } catch (error) {
      if (pgErrorCode(error) === CHECK_VIOLATION) {
        throw new AppError('INSUFFICIENT_BALANCE', 'Not enough coins', { accountId })
      }
      throw error
    }
  }

  await tx.insert(ledgerEntries).values(
    input.entries.map((entry) => ({
      transactionId: inserted.id,
      accountId: entry.accountId,
      amount: entry.amount,
    })),
  )

  return { status: 'posted', transactionId: inserted.id }
}
