import { accounts, ledgerEntries, transactions } from '@jhandi/db/schema/ledger'
import { platformSettings } from '@jhandi/db/schema/platformSettings'
import { bets, rooms, rounds } from '@jhandi/db/schema/rooms'
import { authIdentities, users } from '@jhandi/db/schema/users'
import { and, count, desc, eq, ilike, isNotNull, ne, or, sql } from 'drizzle-orm'
import type { DbOrTx } from '@jhandi/db/database'
import { db } from '#lib/db'

// Drizzle renders a main-table column in a select list without its table name ("id"), which a
// correlated subquery would resolve against its own table. Spell the outer columns out instead.
const USER_ID = sql.raw('"jhandi"."users"."id"')
const ROOM_ID = sql.raw('"jhandi"."rooms"."id"')

const userColumns = {
  id: users.id,
  displayName: users.displayName,
  status: users.status,
  isAdmin: users.isAdmin,
  createdAt: users.createdAt,
  signupIpHash: users.signupIpHash,
  phone: sql<
    string | null
  >`(select ${authIdentities.subject} from ${authIdentities} where ${authIdentities.userId} = ${USER_ID} and ${authIdentities.provider} = 'PHONE' limit 1)`,
  balance: sql<number>`coalesce((select ${accounts.balance} from ${accounts} where ${accounts.type} = 'USER' and ${accounts.ownerId} = ${USER_ID}), 0)::float8`,
}

// By id, phone fragment or name fragment.
export const searchUsers = async (query: string, limit = 20) => {
  const idMatch = /^[0-9a-f-]{36}$/i.test(query) ? eq(users.id, query) : undefined
  return db
    .select(userColumns)
    .from(users)
    .where(
      or(
        idMatch,
        ilike(users.displayName, `%${query}%`),
        sql`exists (select 1 from ${authIdentities} where ${authIdentities.userId} = ${USER_ID} and ${authIdentities.subject} ilike ${`%${query}%`})`,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit)
}

export const getUserForAdmin = async (userId: string) => {
  const [row] = await db.select(userColumns).from(users).where(eq(users.id, userId))
  return row
}

export const countSameIp = async (
  ipHash: string | null,
  excludeUserId: string,
): Promise<number> => {
  if (!ipHash) return 0
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.signupIpHash, ipHash), ne(users.id, excludeUserId)))
  return row?.n ?? 0
}

export const setUserStatus = async (
  conn: DbOrTx,
  userId: string,
  status: 'ACTIVE' | 'FROZEN' | 'BANNED',
) => {
  const rows = await conn
    .update(users)
    .set({ status })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
  return rows.length === 1
}

export const listRoomsForAdmin = async (limit = 50) =>
  db
    .select({
      id: rooms.id,
      name: rooms.name,
      visibility: rooms.visibility,
      status: rooms.status,
      hostId: rooms.hostId,
      hostName: users.displayName,
      createdAt: rooms.createdAt,
      bankBalance: sql<number>`coalesce((select ${accounts.balance} from ${accounts} where ${accounts.type} = 'ROOM_BANK' and ${accounts.ownerId} = ${ROOM_ID}), 0)::float8`,
      rounds: sql<number>`(select count(*) from ${rounds} where ${rounds.roomId} = ${ROOM_ID})::int`,
    })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .orderBy(desc(rooms.createdAt))
    .limit(limit)

export const listSettings = async () => db.select().from(platformSettings)

export const updateSetting = async (
  conn: typeof db,
  key: string,
  value: number,
  updatedBy: string,
) => {
  const rows = await conn
    .update(platformSettings)
    .set({ value, updatedBy, updatedAt: sql`now()` })
    .where(eq(platformSettings.key, key))
    .returning({ key: platformSettings.key })
  return rows.length === 1
}

// Players who took the most from a host's bank, per room, over the last N days.
export const collusionReport = async (days: number, minNetWon: number, limit = 50) => {
  const host = sql`host`
  const player = sql`player`
  return db
    .select({
      roomId: rooms.id,
      roomName: rooms.name,
      visibility: rooms.visibility,
      hostId: rooms.hostId,
      hostName: sql<string>`${host}.display_name`,
      playerId: bets.userId,
      playerName: sql<string>`${player}.display_name`,
      netWon: sql<number>`sum(coalesce(${bets.payout}, 0) - ${bets.amount})::float8`,
      betCount: sql<number>`count(*)::int`,
    })
    .from(bets)
    .innerJoin(rounds, eq(rounds.id, bets.roundId))
    .innerJoin(rooms, eq(rooms.id, rounds.roomId))
    .innerJoin(sql`${users} as host`, sql`${host}.id = ${rooms.hostId}`)
    .innerJoin(sql`${users} as player`, sql`${player}.id = ${bets.userId}`)
    .where(
      and(isNotNull(bets.payout), sql`${bets.createdAt} > now() - make_interval(days => ${days})`),
    )
    .groupBy(
      rooms.id,
      rooms.name,
      rooms.visibility,
      rooms.hostId,
      sql`${host}.display_name`,
      bets.userId,
      sql`${player}.display_name`,
    )
    .having(sql`sum(coalesce(${bets.payout}, 0) - ${bets.amount}) >= ${minNetWon}`)
    .orderBy(sql`sum(coalesce(${bets.payout}, 0) - ${bets.amount}) desc`)
    .limit(limit)
}

export const listLedgerForUser = async (accountId: string, limit: number, beforeId?: number) =>
  db
    .select({
      id: ledgerEntries.id,
      kind: transactions.kind,
      amount: ledgerEntries.amount,
      refType: transactions.refType,
      refId: transactions.refId,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(transactions, eq(transactions.id, ledgerEntries.transactionId))
    .where(
      and(
        eq(ledgerEntries.accountId, accountId),
        beforeId === undefined ? undefined : sql`${ledgerEntries.id} < ${beforeId}`,
      ),
    )
    .orderBy(desc(ledgerEntries.id))
    .limit(limit)
