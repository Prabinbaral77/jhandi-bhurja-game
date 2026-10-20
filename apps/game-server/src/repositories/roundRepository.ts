import type { DbOrTx } from '@jhandi/db/database'
import { bets, rounds } from '@jhandi/db/schema/rooms'
import { and, desc, eq, inArray, isNotNull, max, sql } from 'drizzle-orm'
import { db } from '#lib/db'

export const nextRoundNo = async (roomId: string): Promise<number> => {
  const [row] = await db
    .select({ last: max(rounds.roundNo) })
    .from(rounds)
    .where(eq(rounds.roomId, roomId))
  return (row?.last ?? 0) + 1
}

export const insertRound = async (input: {
  id: string
  roomId: string
  roundNo: number
  seedHash: string
}) => {
  await db.insert(rounds).values(input)
}

export const markRoundLocked = async (roundId: string) => {
  await db
    .update(rounds)
    .set({ status: 'LOCKED', lockedAt: sql`now()` })
    .where(eq(rounds.id, roundId))
}

export const markRoundSettled = async (
  tx: DbOrTx,
  roundId: string,
  result: {
    serverSeed: string
    dice: number[]
    losingStakes: number
    winningsPaid: number
    platformFee: number
  },
) => {
  await tx
    .update(rounds)
    .set({ status: 'SETTLED', settledAt: sql`now()`, ...result })
    .where(eq(rounds.id, roundId))
}

export const markRoundVoided = async (tx: DbOrTx, roundId: string) => {
  await tx
    .update(rounds)
    .set({ status: 'VOIDED', settledAt: sql`now()` })
    .where(eq(rounds.id, roundId))
}

export const findUnfinishedRounds = async (roomId?: string) =>
  db
    .select({ id: rounds.id, roomId: rounds.roomId })
    .from(rounds)
    .where(
      and(
        inArray(rounds.status, ['BETTING', 'LOCKED']),
        roomId === undefined ? undefined : eq(rounds.roomId, roomId),
      ),
    )

export const recentDice = async (roomId: string, limit: number): Promise<number[][]> => {
  const rows = await db
    .select({ dice: rounds.dice })
    .from(rounds)
    .where(and(eq(rounds.roomId, roomId), eq(rounds.status, 'SETTLED'), isNotNull(rounds.dice)))
    .orderBy(desc(rounds.roundNo))
    .limit(limit)
  return rows.flatMap((r) => (r.dice ? [r.dice] : []))
}

// ---------- bets ----------

export const upsertBet = async (
  tx: DbOrTx,
  input: { id: string; roundId: string; userId: string; symbol: string; amount: number },
) => {
  // Re-betting a cancelled symbol starts fresh; otherwise amounts add up.
  await tx
    .insert(bets)
    .values(input)
    .onConflictDoUpdate({
      target: [bets.roundId, bets.userId, bets.symbol],
      set: {
        amount: sql`CASE WHEN ${bets.status} = 'CANCELLED' THEN excluded.amount ELSE ${bets.amount} + excluded.amount END`,
        status: 'PLACED',
      },
    })
}

export const markBetCancelled = async (
  tx: DbOrTx,
  roundId: string,
  userId: string,
  symbol: string,
) => {
  await tx
    .update(bets)
    .set({ status: 'CANCELLED' })
    .where(and(eq(bets.roundId, roundId), eq(bets.userId, userId), eq(bets.symbol, symbol)))
}

export const listPlacedBets = async (conn: DbOrTx, roundId: string) =>
  conn
    .select({ id: bets.id, userId: bets.userId, symbol: bets.symbol, amount: bets.amount })
    .from(bets)
    .where(and(eq(bets.roundId, roundId), eq(bets.status, 'PLACED')))

// One statement for the whole round instead of one UPDATE per bet.
export const applyBetResults = async (
  tx: DbOrTx,
  roundId: string,
  results: readonly { userId: string; symbol: string; won: boolean; payout: number }[],
) => {
  if (results.length === 0) return
  const values = sql.join(
    results.map(
      (r) =>
        sql`(${r.userId}::uuid, ${r.symbol}::text, ${r.won ? 'WON' : 'LOST'}::text, ${r.payout}::bigint)`,
    ),
    sql`, `,
  )
  await tx.execute(sql`
    UPDATE ${bets} SET status = v.status::jhandi.bet_status, payout = v.payout
    FROM (VALUES ${values}) AS v(user_id, symbol, status, payout)
    WHERE ${bets.roundId} = ${roundId} AND ${bets.status} = 'PLACED'
      AND ${bets.userId} = v.user_id AND ${bets.symbol} = v.symbol`)
}

export const markBetsRefunded = async (tx: DbOrTx, roundId: string) => {
  await tx
    .update(bets)
    .set({ status: 'REFUNDED', payout: bets.amount })
    .where(and(eq(bets.roundId, roundId), eq(bets.status, 'PLACED')))
}
