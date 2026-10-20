import type { DbOrTx } from '@jhandi/db/database'
import { authIdentities, users, type User } from '@jhandi/db/schema/users'
import { and, eq } from 'drizzle-orm'
import { db } from '#lib/db'

export type AuthProvider = 'PHONE' | 'GOOGLE'

export const findUserByIdentity = async (
  provider: AuthProvider,
  subject: string,
  conn: DbOrTx = db,
): Promise<User | undefined> => {
  const [row] = await conn
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.subject, subject)))
  return row?.user
}

export const findUserById = async (id: string): Promise<User | undefined> => {
  const [row] = await db.select().from(users).where(eq(users.id, id))
  return row
}

export const insertUserWithIdentity = async (
  tx: DbOrTx,
  input: {
    userId: string
    identityId: string
    displayName: string
    avatarUrl: string | null
    provider: AuthProvider
    subject: string
  },
): Promise<User> => {
  const [user] = await tx
    .insert(users)
    .values({ id: input.userId, displayName: input.displayName, avatarUrl: input.avatarUrl })
    .returning()
  if (!user) throw new Error('User insert returned nothing')
  await tx.insert(authIdentities).values({
    id: input.identityId,
    userId: input.userId,
    provider: input.provider,
    subject: input.subject,
  })
  return user
}

export const updateUser = async (
  id: string,
  changes: { displayName?: string | undefined },
): Promise<User | undefined> => {
  if (changes.displayName === undefined) return findUserById(id)
  const [row] = await db
    .update(users)
    .set({ displayName: changes.displayName })
    .where(eq(users.id, id))
    .returning()
  return row
}
