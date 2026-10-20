import type { DbOrTx } from '@jhandi/db/database'
import { accounts, ledgerEntries } from '@jhandi/db/schema/ledger'
import { eq, sql } from 'drizzle-orm'

export interface ReconciliationReport {
  ok: boolean
  // Transactions whose entries don't sum to 0.
  unbalancedTransactions: number
  // Sum of all account balances; must be 0 (coins held = coins issued by SYSTEM:BONUS).
  totalBalance: number
  // Accounts whose stored balance differs from the sum of their ledger entries.
  driftedAccounts: number
}

const countAll = sql<number>`count(*)::int`

// docs/database.md — nightly check that no coin was created or lost.
export const reconcileLedger = async (db: DbOrTx): Promise<ReconciliationReport> => {
  const unbalancedSub = db
    .select({ transactionId: ledgerEntries.transactionId })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.transactionId)
    .having(sql`sum(${ledgerEntries.amount}) <> 0`)
    .as('unbalanced')
  const [unbalanced] = await db.select({ count: countAll }).from(unbalancedSub)

  const [total] = await db
    .select({ total: sql<string>`coalesce(sum(${accounts.balance}), 0)::text` })
    .from(accounts)

  const entryTotals = db
    .select({
      accountId: ledgerEntries.accountId,
      total: sql<string>`sum(${ledgerEntries.amount})`.as('total'),
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.accountId)
    .as('entry_totals')
  const [drifted] = await db
    .select({ count: countAll })
    .from(accounts)
    .leftJoin(entryTotals, eq(entryTotals.accountId, accounts.id))
    .where(sql`${accounts.balance} <> coalesce(${entryTotals.total}, 0)`)

  const report = {
    unbalancedTransactions: unbalanced?.count ?? 0,
    totalBalance: Number(total?.total ?? 0),
    driftedAccounts: drifted?.count ?? 0,
  }
  return {
    ok:
      report.unbalancedTransactions === 0 &&
      report.totalBalance === 0 &&
      report.driftedAccounts === 0,
    ...report,
  }
}
