import { newId } from '@jhandi/db/ids'
import { refreshTokens } from '@jhandi/db/schema/users'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '#lib/db'

export const insertRefreshToken = async (input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) => {
  await db.insert(refreshTokens).values({ id: newId(), ...input })
}

export const findRefreshToken = async (tokenHash: string) => {
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
  return row
}

// Atomic: returns false if another request already rotated this token.
export const revokeRefreshToken = async (id: string): Promise<boolean> => {
  const rows = await db
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id })
  return rows.length === 1
}

export const revokeAllRefreshTokens = async (userId: string) => {
  await db
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
}
