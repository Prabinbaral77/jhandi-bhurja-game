import { SETTING_KEYS } from '@jhandi/db/settings'
import { SYMBOLS } from '@jhandi/game-rules/symbols'
import { getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { AppError } from '@jhandi/protocol/appError'
import type { z } from 'zod'
import type {
  adminOverviewSchema,
  adminRoomSchema,
  adminRoundSchema,
  adminUserSchema,
  auditEntrySchema,
  collusionFlagSchema,
} from '@jhandi/protocol/admin'
import { db } from '#lib/db'
import { cached } from '#lib/cache'
import {
  collusionReport,
  countSameIp,
  feeByDay,
  getUserForAdmin,
  listLedgerForUser,
  listRoomsForAdmin,
  listRoundsForAdmin,
  listSettings,
  listTopBalances,
  overviewStats,
  searchUsers,
  setUserStatus,
  updateSetting,
} from '#repositories/adminRepository'
import { listAudit, writeAudit } from '#repositories/auditRepository'
import { revokeAllRefreshTokens } from '#repositories/refreshTokenRepository'
import { invalidateSettings } from '#services/settingsService'
import { kathmanduDayStart } from '#utils/nepalTime'

type AdminUser = z.infer<typeof adminUserSchema>
type AdminRoom = z.infer<typeof adminRoomSchema>
type AdminRound = z.infer<typeof adminRoundSchema>
type AdminOverview = z.infer<typeof adminOverviewSchema>
type AuditEntry = z.infer<typeof auditEntrySchema>
type CollusionFlag = z.infer<typeof collusionFlagSchema>

const toAdminUser = async (
  row: NonNullable<Awaited<ReturnType<typeof getUserForAdmin>>>,
): Promise<AdminUser> => ({
  id: row.id,
  displayName: row.displayName,
  phone: row.phone,
  email: row.email,
  status: row.status,
  isAdmin: row.isAdmin,
  balance: row.balance,
  createdAt: row.createdAt.getTime(),
  sameIpAccounts: await countSameIp(row.signupIpHash, row.id),
})

export const adminSearchUsers = async (query: string): Promise<AdminUser[]> =>
  Promise.all((await searchUsers(query)).map(toAdminUser))

export const adminGetUser = async (userId: string): Promise<AdminUser> => {
  const row = await getUserForAdmin(userId)
  if (!row) throw new AppError('NOT_FOUND', 'User not found')
  return toAdminUser(row)
}

// Freeze/ban also logs the user out everywhere; access tokens expire within 15 min.
export const adminSetUserStatus = async (
  actorId: string,
  input: { userId: string; status: AdminUser['status']; reason: string },
): Promise<AdminUser> => {
  if (input.userId === actorId) throw new AppError('FORBIDDEN', 'You cannot change your own status')
  await db.transaction(async (tx) => {
    const ok = await setUserStatus(tx, input.userId, input.status)
    if (!ok) throw new AppError('NOT_FOUND', 'User not found')
    await writeAudit(tx, {
      actorId,
      action: 'user.set_status',
      target: `user:${input.userId}`,
      data: { status: input.status, reason: input.reason },
    })
  })
  if (input.status !== 'ACTIVE') await revokeAllRefreshTokens(input.userId)
  return adminGetUser(input.userId)
}

export const adminAdjustCoins = async (
  actorId: string,
  input: { userId: string; amount: number; reason: string; idempotencyKey: string },
): Promise<AdminUser> => {
  const target = await getUserForAdmin(input.userId)
  if (!target) throw new AppError('NOT_FOUND', 'User not found')
  await db.transaction(async (tx) => {
    const accountId = await getOrCreateAccount(tx, 'USER', input.userId)
    const posted = await postTransaction(tx, {
      kind: 'ADJUSTMENT',
      idempotencyKey: `adjust:${input.idempotencyKey}`,
      refType: 'USER',
      refId: input.userId,
      entries: [
        { accountId: SYSTEM_ACCOUNT_IDS.ADJUSTMENT, amount: -input.amount },
        { accountId, amount: input.amount },
      ],
    })
    if (posted.status === 'posted') {
      await writeAudit(tx, {
        actorId,
        action: 'coins.adjust',
        target: `user:${input.userId}`,
        data: { amount: input.amount, reason: input.reason, transactionId: posted.transactionId },
      })
    }
  })
  return adminGetUser(input.userId)
}

export const adminUserLedger = async (
  userId: string,
  page: { cursor?: string | undefined; limit: number },
) => {
  const accountId = await getOrCreateAccount(db, 'USER', userId)
  const beforeId = page.cursor === undefined ? undefined : Number(page.cursor)
  if (beforeId !== undefined && !Number.isSafeInteger(beforeId))
    throw new AppError('VALIDATION_FAILED', 'Invalid cursor')
  const rows = await listLedgerForUser(accountId, page.limit + 1, beforeId)
  const items = rows.slice(0, page.limit).map((r) => ({
    id: String(r.id),
    kind: r.kind,
    amount: r.amount,
    refType: r.refType,
    refId: r.refId,
    createdAt: r.createdAt.getTime(),
  }))
  const last = items.at(-1)
  return { items, nextCursor: rows.length > page.limit && last ? last.id : null }
}

export const adminListRooms = async (scope: 'live' | 'all' = 'live'): Promise<AdminRoom[]> =>
  (await listRoomsForAdmin(scope)).map((r) => ({
    roomId: r.id,
    name: r.name,
    visibility: r.visibility,
    status: r.status,
    host: { id: r.hostId, displayName: r.hostName },
    bankBalance: r.bankBalance,
    rounds: r.rounds,
    members: r.members,
    platformFee: r.platformFee,
    losingStakes: r.losingStakes,
    winningsPaid: r.winningsPaid,
    roundInPlay: r.roundInPlay,
    lastRoundAt: r.lastRoundAt ? new Date(r.lastRoundAt).getTime() : null,
    createdAt: r.createdAt.getTime(),
  }))

export const adminRoomRounds = async (roomId: string): Promise<AdminRound[]> =>
  (await listRoundsForAdmin(roomId)).map((r) => ({
    roundId: r.id,
    roundNo: r.roundNo,
    status: r.status,
    dice: r.dice ? r.dice.map((d) => SYMBOLS[d] ?? String(d)) : null,
    bets: r.bets,
    staked: r.staked,
    losingStakes: r.losingStakes ?? 0,
    winningsPaid: r.winningsPaid ?? 0,
    platformFee: r.platformFee ?? 0,
    startedAt: r.startedAt.getTime(),
    settledAt: r.settledAt?.getTime() ?? null,
  }))

// Who holds the coins: wallets sorted by balance.
export const adminTopBalances = async (limit: number): Promise<AdminUser[]> =>
  Promise.all((await listTopBalances(limit)).map(toAdminUser))

const OVERVIEW_TTL_SEC = 5
const DAY_MS = 24 * 60 * 60 * 1000

// Every number on the dashboard; one DB round trip, cached a few seconds (many admins / tabs).
export const adminOverview = (): Promise<AdminOverview> =>
  cached('admin:overview:v1', OVERVIEW_TTL_SEC, async () => {
    const now = new Date()
    const dayStart = kathmanduDayStart(now)
    const weekStart = new Date(dayStart.getTime() - 6 * DAY_MS)
    const [s, days] = await Promise.all([overviewStats(dayStart, weekStart), feeByDay(14)])
    return {
      generatedAt: now.getTime(),
      rooms: {
        live: s.liveRooms,
        roundsInPlay: s.roundsInPlay,
        hosts: s.hosts,
        players: s.players,
        spectators: s.spectators,
      },
      platformFee: {
        total: s.feeTotal,
        today: s.feeToday,
        last7Days: s.feeWeek,
        roundsToday: s.roundsToday,
      },
      coins: {
        inWallets: s.inWallets,
        inRoomBanks: s.inBanks,
        inEscrow: s.inEscrow,
        bonusesIssued: s.bonusesIssued,
        adjustmentsNet: s.adjustmentsNet,
      },
      users: {
        total: s.usersTotal,
        signedUpToday: s.usersToday,
        betToday: s.bettorsToday,
        frozenOrBanned: s.frozenOrBanned,
      },
      feeByDay: days.map((d) => ({ date: d.date, rounds: d.rounds, fee: d.fee })),
    }
  })

export const adminGetSettings = async (): Promise<Record<string, number>> =>
  Object.fromEntries((await listSettings()).map((r) => [r.key, Number(r.value)]))

export const adminUpdateSetting = async (
  actorId: string,
  input: { key: string; value: number },
): Promise<Record<string, number>> => {
  if (!(SETTING_KEYS as readonly string[]).includes(input.key)) {
    throw new AppError('VALIDATION_FAILED', `Unknown setting ${input.key}`)
  }
  const before = (await adminGetSettings())[input.key]
  await db.transaction(async (tx) => {
    const ok = await updateSetting(tx, input.key, input.value, actorId)
    if (!ok) throw new AppError('NOT_FOUND', 'Setting not found')
    await writeAudit(tx, {
      actorId,
      action: 'settings.update',
      target: `settings:${input.key}`,
      data: { from: before, to: input.value },
    })
  })
  await invalidateSettings()
  return adminGetSettings()
}

export const adminAudit = async (page: { cursor?: string | undefined; limit: number }) => {
  const beforeId = page.cursor === undefined ? undefined : Number(page.cursor)
  const rows = await listAudit(page.limit + 1, beforeId)
  const items: AuditEntry[] = rows.slice(0, page.limit).map((r) => ({
    id: String(r.id),
    actor: r.actorId ? { id: r.actorId, displayName: r.actorName ?? '' } : null,
    action: r.action,
    target: r.target,
    data: r.data,
    createdAt: r.createdAt.getTime(),
  }))
  const last = items.at(-1)
  return { items, nextCursor: rows.length > page.limit && last ? last.id : null }
}

export const adminCollusion = async (days = 7, minNetWon = 3_000): Promise<CollusionFlag[]> =>
  (await collusionReport(days, minNetWon)).map((r) => ({
    roomId: r.roomId,
    roomName: r.roomName,
    visibility: r.visibility,
    host: { id: r.hostId, displayName: r.hostName },
    player: { id: r.playerId, displayName: r.playerName },
    netWon: r.netWon,
    bets: r.betCount,
  }))
