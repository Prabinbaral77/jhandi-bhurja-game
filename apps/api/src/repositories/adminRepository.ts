import { accounts, ledgerEntries, transactions } from '@jhandi/db/schema/ledger'
import { platformSettings } from '@jhandi/db/schema/platformSettings'
import { bets, roomMembers, rooms, rounds } from '@jhandi/db/schema/rooms'
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
  email: users.email,
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
        ilike(users.email, `%${query}%`),
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

const ACTIVE_MEMBER = sql`${roomMembers.leftAt} is null and ${roomMembers.removedAt} is null`

export const listRoomsForAdmin = async (scope: 'live' | 'all', limit = 200) =>
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
      members: sql<number>`case when ${rooms.status} = 'CLOSED' then 0 else (select count(*) from ${roomMembers} where ${roomMembers.roomId} = ${ROOM_ID} and ${ACTIVE_MEMBER}) end::int`,
      platformFee: sql<number>`coalesce((select sum(${rounds.platformFee}) from ${rounds} where ${rounds.roomId} = ${ROOM_ID}), 0)::float8`,
      losingStakes: sql<number>`coalesce((select sum(${rounds.losingStakes}) from ${rounds} where ${rounds.roomId} = ${ROOM_ID}), 0)::float8`,
      winningsPaid: sql<number>`coalesce((select sum(${rounds.winningsPaid}) from ${rounds} where ${rounds.roomId} = ${ROOM_ID}), 0)::float8`,
      roundInPlay: sql<boolean>`exists (select 1 from ${rounds} where ${rounds.roomId} = ${ROOM_ID} and ${rounds.status} in ('BETTING', 'LOCKED'))`,
      lastRoundAt: sql<Date | null>`(select max(${rounds.startedAt}) from ${rounds} where ${rounds.roomId} = ${ROOM_ID})`,
    })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(scope === 'live' ? ne(rooms.status, 'CLOSED') : undefined)
    .orderBy(desc(rooms.createdAt))
    .limit(limit)

export const listRoundsForAdmin = async (roomId: string, limit = 100) =>
  db
    .select({
      id: rounds.id,
      roundNo: rounds.roundNo,
      status: rounds.status,
      dice: rounds.dice,
      losingStakes: rounds.losingStakes,
      winningsPaid: rounds.winningsPaid,
      platformFee: rounds.platformFee,
      startedAt: rounds.startedAt,
      settledAt: rounds.settledAt,
      bets: sql<number>`(select count(*) from ${bets} where ${bets.roundId} = ${sql.raw('"jhandi"."rounds"."id"')})::int`,
      staked: sql<number>`coalesce((select sum(${bets.amount}) from ${bets} where ${bets.roundId} = ${sql.raw('"jhandi"."rounds"."id"')} and ${bets.status} <> 'CANCELLED'), 0)::float8`,
    })
    .from(rounds)
    .where(eq(rounds.roomId, roomId))
    .orderBy(desc(rounds.roundNo))
    .limit(limit)

export const listTopBalances = async (limit: number) =>
  db
    .select(userColumns)
    .from(users)
    .orderBy(sql`${userColumns.balance} desc`, desc(users.createdAt))
    .limit(limit)

const systemBalance = (code: string) =>
  sql<number>`coalesce((select ${accounts.balance} from ${accounts} where ${accounts.type} = 'SYSTEM' and ${accounts.code} = ${code}), 0)::float8`
const typeTotal = (type: string) =>
  sql<number>`coalesce((select sum(${accounts.balance}) from ${accounts} where ${accounts.type} = ${type}), 0)::float8`

const liveMembers = (role: string) =>
  sql<number>`(select count(*) from ${roomMembers} m join ${rooms} r on r.id = m.room_id where r.status <> 'CLOSED' and m.left_at is null and m.removed_at is null and m.role = ${role})::int`

// One round trip: every number on the operator dashboard. `dayStart` = Kathmandu midnight.
export const overviewStats = async (dayStartAt: Date, weekStartAt: Date) => {
  // Raw `sql` params go to the driver untyped: pass timestamps as ISO strings.
  const dayStart = sql`${dayStartAt.toISOString()}::timestamptz`
  const weekStart = sql`${weekStartAt.toISOString()}::timestamptz`
  const [row] = await db
    .select({
      liveRooms: sql<number>`(select count(*) from ${rooms} where ${rooms.status} <> 'CLOSED')::int`,
      roundsInPlay: sql<number>`(select count(*) from ${rounds} where ${rounds.status} in ('BETTING', 'LOCKED'))::int`,
      hosts: liveMembers('HOST'),
      players: liveMembers('PLAYER'),
      spectators: liveMembers('SPECTATOR'),
      feeTotal: systemBalance('PLATFORM_FEE'),
      feeToday: sql<number>`coalesce((select sum(${rounds.platformFee}) from ${rounds} where ${rounds.settledAt} >= ${dayStart}), 0)::float8`,
      feeWeek: sql<number>`coalesce((select sum(${rounds.platformFee}) from ${rounds} where ${rounds.settledAt} >= ${weekStart}), 0)::float8`,
      roundsToday: sql<number>`(select count(*) from ${rounds} where ${rounds.settledAt} >= ${dayStart})::int`,
      inWallets: typeTotal('USER'),
      inBanks: typeTotal('ROOM_BANK'),
      inEscrow: typeTotal('ROUND_ESCROW'),
      bonusesIssued: sql<number>`-${systemBalance('BONUS')}`,
      adjustmentsNet: sql<number>`-${systemBalance('ADJUSTMENT')}`,
      usersTotal: sql<number>`(select count(*) from ${users})::int`,
      usersToday: sql<number>`(select count(*) from ${users} where ${users.createdAt} >= ${dayStart})::int`,
      bettorsToday: sql<number>`(select count(distinct ${bets.userId}) from ${bets} where ${bets.createdAt} >= ${dayStart})::int`,
      frozenOrBanned: sql<number>`(select count(*) from ${users} where ${users.status} <> 'ACTIVE')::int`,
    })
    .from(sql`(select 1) as one`)
  if (!row) throw new Error('overview query returned nothing')
  return row
}

// Platform fee per Kathmandu calendar day for the last N days (settled rounds only).
export const feeByDay = async (days: number) => {
  const day = sql<string>`to_char(${rounds.settledAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`
  return db
    .select({
      date: day,
      rounds: sql<number>`count(*)::int`,
      fee: sql<number>`coalesce(sum(${rounds.platformFee}), 0)::float8`,
    })
    .from(rounds)
    .where(
      and(
        eq(rounds.status, 'SETTLED'),
        sql`${rounds.settledAt} >= now() - make_interval(days => ${days})`,
      ),
    )
    .groupBy(day)
    .orderBy(desc(day))
}

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
