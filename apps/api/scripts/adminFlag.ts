import { authIdentities, users } from '@jhandi/db/schema/users'
import { eq } from 'drizzle-orm'
import { db, sql } from '#lib/db'
import { writeAudit } from '#repositories/auditRepository'

const findUserId = async (who: string): Promise<string | undefined> => {
  if (who.includes('@')) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, who.toLowerCase()))
    return row?.id
  }
  const [identity] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(eq(authIdentities.subject, who))
  return identity?.userId
}

export const setAdminFlag = async (who: string | undefined, isAdmin: boolean): Promise<void> => {
  if (!who) {
    console.error(`usage: admin:${isAdmin ? 'grant' : 'revoke'} <+977 phone | e-mail>`)
    process.exit(1)
  }
  const userId = await findUserId(who)
  if (!userId) {
    console.error(
      `no user with phone/e-mail ${who} (an e-mail is known only after a Google sign-in)`,
    )
    process.exit(1)
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isAdmin }).where(eq(users.id, userId))
    await writeAudit(tx, {
      actorId: null,
      action: isAdmin ? 'admin.grant' : 'admin.revoke',
      target: `user:${userId}`,
      data: { via: 'cli', who },
    })
  })
  const admins = await db
    .select({ id: users.id, name: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true))
  console.log(`${who} (${userId}) is ${isAdmin ? 'now' : 'no longer'} an admin`)
  console.log(
    `admins now: ${admins.map((a) => `${a.name}${a.email ? ` <${a.email}>` : ''}`).join(', ') || 'none'}`,
  )
  await sql.end({ timeout: 5 })
}
