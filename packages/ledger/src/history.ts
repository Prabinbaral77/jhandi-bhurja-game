import type { DbOrTx } from '@jhandi/db/database'
import { ledgerEntries, transactions } from '@jhandi/db/schema/ledger'
import { and, desc, eq, lt } from 'drizzle-orm'

export interface AccountHistoryItem {
  entryId: number
  kind: (typeof transactions.$inferSelect)['kind']
  amount: number
  refType: string | null
  refId: string | null
  createdAt: Date
}

export interface AccountHistoryPage {
  items: AccountHistoryItem[]
  nextCursor: string | null
}

// Newest first, cursor = last entry id seen (docs/api-protocol.md §1 pagination).
export const getAccountHistory = async (
  db: DbOrTx,
  accountId: string,
  { cursor, limit }: { cursor?: string | undefined; limit: number },
): Promise<AccountHistoryPage> => {
  const beforeId = cursor === undefined ? undefined : Number(cursor)
  if (beforeId !== undefined && !Number.isSafeInteger(beforeId)) throw new Error('Invalid cursor')

  const rows = await db
    .select({
      entryId: ledgerEntries.id,
      kind: transactions.kind,
      amount: ledgerEntries.amount,
      refType: transactions.refType,
      refId: transactions.refId,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(transactions, eq(transactions.id, ledgerEntries.transactionId))
    .where(
      and(
        eq(ledgerEntries.accountId, accountId),
        beforeId === undefined ? undefined : lt(ledgerEntries.id, beforeId),
      ),
    )
    .orderBy(desc(ledgerEntries.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return { items, nextCursor: rows.length > limit && last ? String(last.entryId) : null }
}
