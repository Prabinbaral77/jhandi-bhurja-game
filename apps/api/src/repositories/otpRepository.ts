import { newId } from '@jhandi/db/ids'
import { otpCodes } from '@jhandi/db/schema/users'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '#lib/db'

export const insertOtp = async (input: { phone: string; codeHash: string; expiresAt: Date }) => {
  await db.insert(otpCodes).values({ id: newId(), ...input })
}

export const listRecentOtps = async (phone: string, since: Date) =>
  db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, since)))
    .orderBy(desc(otpCodes.createdAt))

export const findActiveOtp = async (phone: string, now: Date) => {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, now)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
  return row
}

export const incrementOtpAttempts = async (id: string) => {
  await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(eq(otpCodes.id, id))
}

// Atomic: only one concurrent verify can consume a code.
export const consumeOtp = async (id: string): Promise<boolean> => {
  const rows = await db
    .update(otpCodes)
    .set({ consumedAt: sql`now()` })
    .where(and(eq(otpCodes.id, id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id })
  return rows.length === 1
}
