import { authIdentities } from '@jhandi/db/schema/users'
import { getBalance, getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { eq } from 'drizzle-orm'
import { db, sql } from '#lib/db'
import { env } from '#lib/env'
import { writeAudit } from '#repositories/auditRepository'

// Development only: give a test account coins to play with. Refused in production.
//   pnpm --filter @jhandi/api dev:topup +9779812345678 100000
if (env.NODE_ENV === 'production') {
  console.error('dev:topup is not available in production; use the admin panel')
  process.exit(1)
}
const phone = process.argv[2]
const amount = Number(process.argv[3] ?? 100_000)
if (!phone || !Number.isSafeInteger(amount) || amount <= 0) {
  console.error('usage: dev:topup <+977 phone> [coins]')
  process.exit(1)
}
const [identity] = await db
  .select({ userId: authIdentities.userId })
  .from(authIdentities)
  .where(eq(authIdentities.subject, phone))
if (!identity) {
  console.error(`no user with ${phone} — sign in once with that number first`)
  await sql.end({ timeout: 5 })
  process.exit(1)
}
await db.transaction(async (tx) => {
  const accountId = await getOrCreateAccount(tx, 'USER', identity.userId)
  await postTransaction(tx, {
    kind: 'ADJUSTMENT',
    idempotencyKey: `adjust:dev-topup:${identity.userId}:${Date.now()}`,
    refType: 'USER',
    refId: identity.userId,
    entries: [
      { accountId: SYSTEM_ACCOUNT_IDS.ADJUSTMENT, amount: -amount },
      { accountId, amount },
    ],
  })
  await writeAudit(tx, {
    actorId: null,
    action: 'coins.adjust',
    target: `user:${identity.userId}`,
    data: { amount, reason: 'dev top-up (CLI)' },
  })
  console.log(`${phone}: +${amount} coins, balance now ${await getBalance(tx, accountId)}`)
})
await sql.end({ timeout: 5 })
