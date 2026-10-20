import type { DbOrTx } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { bonuses } from '@jhandi/db/schema/bonuses'
import { and, eq } from 'drizzle-orm'
import { db } from '#lib/db'

// Returns false when this bonus was already given (unique index on user + kind/date).
export const insertBonus = async (
  tx: DbOrTx,
  input: { userId: string; kind: 'SIGNUP' | 'DAILY'; amount: number; bonusDate: string },
): Promise<boolean> => {
  const rows = await tx
    .insert(bonuses)
    .values({ id: newId(), ...input })
    .onConflictDoNothing()
    .returning({ id: bonuses.id })
  return rows.length === 1
}

export const hasDailyBonus = async (userId: string, bonusDate: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: bonuses.id })
    .from(bonuses)
    .where(
      and(eq(bonuses.userId, userId), eq(bonuses.kind, 'DAILY'), eq(bonuses.bonusDate, bonusDate)),
    )
  return row !== undefined
}
