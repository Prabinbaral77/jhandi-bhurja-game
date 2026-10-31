import { authIdentities, users } from '@jhandi/db/schema/users'
import { eq } from 'drizzle-orm'
import { db, sql } from '#lib/db'
import { writeAudit } from '#repositories/auditRepository'

// Makes a user an admin by phone number. Run on the server, never exposed over the API:
//   pnpm --filter @jhandi/api admin:grant +9779812345678
const phone = process.argv[2]
if (!phone) {
  console.error('usage: admin:grant <+977 phone>')
  process.exit(1)
}
const [identity] = await db
  .select({ userId: authIdentities.userId })
  .from(authIdentities)
  .where(eq(authIdentities.subject, phone))
if (!identity) {
  console.error(`no user with phone ${phone}`)
  process.exit(1)
}
await db.transaction(async (tx) => {
  await tx.update(users).set({ isAdmin: true }).where(eq(users.id, identity.userId))
  await writeAudit(tx, {
    actorId: null,
    action: 'admin.grant',
    target: `user:${identity.userId}`,
    data: { via: 'cli' },
  })
})
console.log(`${phone} (${identity.userId}) is now an admin`)
await sql.end({ timeout: 5 })
