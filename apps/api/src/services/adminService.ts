import { SETTING_KEYS } from '@jhandi/db/settings'
import { getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { AppError } from '@jhandi/protocol/appError'
import type { z } from 'zod'
import type {
  adminRoomSchema,
  adminUserSchema,
  auditEntrySchema,
  collusionFlagSchema,
} from '@jhandi/protocol/admin'
import { db } from '#lib/db'
import {
  collusionReport,
  countSameIp,
  getUserForAdmin,
  listLedgerForUser,
  listRoomsForAdmin,
  listSettings,
  searchUsers,
  setUserStatus,
  updateSetting,
} from '#repositories/adminRepository'
import { listAudit, writeAudit } from '#repositories/auditRepository'
import { revokeAllRefreshTokens } from '#repositories/refreshTokenRepository'
import { invalidateSettings } from '#services/settingsService'

type AdminUser = z.infer<typeof adminUserSchema>
type AdminRoom = z.infer<typeof adminRoomSchema>
type AuditEntry = z.infer<typeof auditEntrySchema>
type CollusionFlag = z.infer<typeof collusionFlagSchema>

const toAdminUser = async (
  row: NonNullable<Awaited<ReturnType<typeof getUserForAdmin>>>,
): Promise<AdminUser> => ({
  id: row.id,
  displayName: row.displayName,
  phone: row.phone,
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

export const adminListRooms = async (): Promise<AdminRoom[]> =>
  (await listRoomsForAdmin()).map((r) => ({
    roomId: r.id,
    name: r.name,
    visibility: r.visibility,
    status: r.status,
    host: { id: r.hostId, displayName: r.hostName },
    bankBalance: r.bankBalance,
    rounds: r.rounds,
    createdAt: r.createdAt.getTime(),
  }))

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
  invalidateSettings()
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
