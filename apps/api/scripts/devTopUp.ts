import { authIdentities, users } from '@jhandi/db/schema/users'
import { getBalance, getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { eq } from 'drizzle-orm'
import { db, sql } from '#lib/db'
import { env } from '#lib/env'
import { writeAudit } from '#repositories/auditRepository'

// Operator CLI: credit coins to an account by phone number or Google e-mail, through the ledger
// (ADJUSTMENT) and the audit log. Refused when NODE_ENV=production; use the admin panel there.
//   pnpm --filter @jhandi/api dev:topup +9779812345678 100000
//   pnpm --filter @jhandi/api dev:topup someone@gmail.com 10000
//   pnpm --filter @jhandi/api dev:topup --list-admins
if (env.NODE_ENV === 'production') {
  console.error('dev:topup is not available in production; use the admin panel')
  process.exit(1)
}
const phone = process.argv[2]
if (phone === '--list-admins') {
  const admins = await db
    .select({ id: users.id, name: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true))
  console.table(admins)
  await sql.end({ timeout: 5 })
  process.exit(0)
}
const amount = Number(process.argv[3] ?? 100_000)
if (!phone || !Number.isSafeInteger(amount) || amount <= 0) {
  console.error('usage: dev:topup <+977 phone | e-mail> [coins]')
  process.exit(1)
}
const findUserId = async (who: string): Promise<string | undefined> => {
  if (who.includes('@')) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, who.toLowerCase()))
    return row?.id
  }
  const [row] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(eq(authIdentities.subject, who))
  return row?.userId
}
const userId = await findUserId(phone)
if (!userId) {
  console.error(`no user with ${phone} — sign in once with that account first`)
  await sql.end({ timeout: 5 })
  process.exit(1)
}
const identity = { userId }
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
