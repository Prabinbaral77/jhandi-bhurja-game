import type { Database } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { accounts } from '@jhandi/db/schema/ledger'
import { users } from '@jhandi/db/schema/users'
import { createTestDb } from '@jhandi/db/testing'
import { AppError } from '@jhandi/protocol/appError'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getBalance, getOrCreateAccount } from '#accounts'
import { getAccountHistory } from '#history'
import { postTransaction } from '#postTransaction'
import { reconcileLedger } from '#reconcile'
import { SYSTEM_ACCOUNT_IDS } from '#systemAccounts'

let db: Database
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 30_000)
afterAll(async () => close())

const newUserAccount = async (): Promise<string> => {
  const userId = newId()
  await db.insert(users).values({ id: userId, displayName: 'Test' })
  return getOrCreateAccount(db, 'USER', userId)
}

const grant = (accountId: string, amount: number, key = newId()) =>
  db.transaction((tx) =>
    postTransaction(tx, {
      kind: 'SIGNUP_BONUS',
      idempotencyKey: key,
      entries: [
        { accountId: SYSTEM_ACCOUNT_IDS.BONUS, amount: -amount },
        { accountId, amount },
      ],
    }),
  )

describe('ledger', () => {
  it('seeds the system accounts', async () => {
    expect(await getBalance(db, SYSTEM_ACCOUNT_IDS.PLATFORM_FEE)).toBe(0)
  })

  it('getOrCreateAccount is idempotent', async () => {
    const userId = newId()
    await db.insert(users).values({ id: userId, displayName: 'Test' })
    const a = await getOrCreateAccount(db, 'USER', userId)
    expect(await getOrCreateAccount(db, 'USER', userId)).toBe(a)
  })

  it('moves coins and keeps both sides in step', async () => {
    const account = await newUserAccount()
    const before = await getBalance(db, SYSTEM_ACCOUNT_IDS.BONUS)
    const result = await grant(account, 5_500)
    expect(result.status).toBe('posted')
    // New balances come back with the result, so callers need no extra query.
    if (result.status === 'posted') expect(result.balances.get(account)).toBe(5_500)
    expect(await getBalance(db, account)).toBe(5_500)
    expect(await getBalance(db, SYSTEM_ACCOUNT_IDS.BONUS)).toBe(before - 5_500)
  })

  it('never applies the same idempotency key twice', async () => {
    const account = await newUserAccount()
    const key = `signup:${account}`
    const first = await grant(account, 5_500, key)
    const second = await grant(account, 5_500, key)
    expect(second).toEqual({ status: 'duplicate', transactionId: first.transactionId })
    expect(await getBalance(db, account)).toBe(5_500)
  })

  it('rejects overspending and rolls back the whole transaction', async () => {
    const from = await newUserAccount()
    const to = await newUserAccount()
    await grant(from, 100)
    const spend = db.transaction((tx) =>
      postTransaction(tx, {
        kind: 'BET',
        idempotencyKey: newId(),
        entries: [
          { accountId: from, amount: -101 },
          { accountId: to, amount: 101 },
        ],
      }),
    )
    await expect(spend).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
    await expect(spend).rejects.toBeInstanceOf(AppError)
    expect(await getBalance(db, from)).toBe(100)
    expect(await getBalance(db, to)).toBe(0)
  })

  it.each([
    [[{ amount: 10 }, { amount: -9 }], /sum to 0/],
    [[{ amount: 10 }], /at least two/],
    [[{ amount: 1.5 }, { amount: -1.5 }], /Invalid ledger amount/],
  ])('rejects invalid entries %#', async (amounts, message) => {
    const account = await newUserAccount()
    const entries = amounts.map(({ amount }) => ({ accountId: account, amount }))
    await expect(
      db.transaction((tx) =>
        postTransaction(tx, { kind: 'ADJUSTMENT', idempotencyKey: newId(), entries }),
      ),
    ).rejects.toThrow(message)
  })

  it('pages account history newest first', async () => {
    const account = await newUserAccount()
    for (const amount of [10, 20, 30]) await grant(account, amount)

    const page1 = await getAccountHistory(db, account, { limit: 2 })
    expect(page1.items.map((i) => i.amount)).toEqual([30, 20])
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await getAccountHistory(db, account, {
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    })
    expect(page2.items.map((i) => i.amount)).toEqual([10])
    expect(page2.nextCursor).toBeNull()
    expect(page2.items[0]?.kind).toBe('SIGNUP_BONUS')
  })

  it('reconciles cleanly, and detects a balance edited outside the ledger', async () => {
    expect(await reconcileLedger(db)).toEqual({
      ok: true,
      unbalancedTransactions: 0,
      totalBalance: 0,
      driftedAccounts: 0,
    })

    const account = await newUserAccount()
    await db.update(accounts).set({ balance: 999 }).where(eq(accounts.id, account))
    expect(await reconcileLedger(db)).toMatchObject({
      ok: false,
      totalBalance: 999,
      driftedAccounts: 1,
    })
  })
})
