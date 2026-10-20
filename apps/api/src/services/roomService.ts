import { newId } from '@jhandi/db/ids'
import { roomLimitsSchema, type RoomLimits } from '@jhandi/game-rules/limits'
import { getOrCreateAccount } from '@jhandi/ledger/accounts'
import { UNIQUE_VIOLATION, pgErrorCode } from '@jhandi/ledger/pgError'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { AppError } from '@jhandi/protocol/appError'
import type { RoomSummary } from '@jhandi/protocol/room'
import { z } from 'zod'
import { db } from '#lib/db'
import { findActiveRoomOfHost, insertRoom, listOpenPublicRooms } from '#repositories/roomRepository'
import { findUserById } from '#repositories/userRepository'
import { getSettings } from '#services/settingsService'

const DEFAULT_VENUE = 'NYATAPOLA'

interface CreateRoomInput {
  name: string
  deposit: number
  limits: Partial<
    Pick<RoomLimits, 'minBet' | 'maxBetPerSymbol' | 'maxBetPerPlayerPerRound' | 'bettingWindowSec'>
  >
}

// docs/architecture.md §2.4 — opening a room locks the host deposit into the room bank.
export const createRoom = async (
  hostId: string,
  input: CreateRoomInput,
): Promise<{ roomId: string }> => {
  const host = await findUserById(hostId)
  if (host?.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'This account is not active')

  const { MIN_HOST_DEPOSIT } = await getSettings()
  if (input.deposit < MIN_HOST_DEPOSIT) {
    throw new AppError('BELOW_MIN_DEPOSIT', `Deposit at least ${MIN_HOST_DEPOSIT} coins`, {
      minDeposit: MIN_HOST_DEPOSIT,
    })
  }

  const limits = roomLimitsSchema.safeParse(input.limits)
  if (!limits.success) {
    throw new AppError('VALIDATION_FAILED', 'Invalid room limits', {
      issues: z.treeifyError(limits.error),
    })
  }

  const roomId = newId()
  try {
    await db.transaction(async (tx) => {
      await insertRoom(tx, {
        id: roomId,
        hostId,
        name: input.name,
        venue: DEFAULT_VENUE,
        config: limits.data,
      })
      const [hostAccount, bankAccount] = await Promise.all([
        getOrCreateAccount(tx, 'USER', hostId),
        getOrCreateAccount(tx, 'ROOM_BANK', roomId),
      ])
      await postTransaction(tx, {
        kind: 'HOST_DEPOSIT',
        idempotencyKey: `host-deposit:${roomId}`,
        refType: 'ROOM',
        refId: roomId,
        entries: [
          { accountId: hostAccount, amount: -input.deposit },
          { accountId: bankAccount, amount: input.deposit },
        ],
      })
    })
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      throw new AppError('FORBIDDEN', 'You are already hosting a room. Close it first.')
    }
    throw error
  }
  return { roomId }
}

type SummaryRow = Awaited<ReturnType<typeof listOpenPublicRooms>>[number]

const toSummary = (row: SummaryRow): RoomSummary => {
  const limits = roomLimitsSchema.parse(row.config)
  return {
    roomId: row.id,
    name: row.name,
    host: { id: row.hostId, displayName: row.hostName },
    status: row.status,
    minBet: limits.minBet,
    maxBetPerSymbol: limits.maxBetPerSymbol,
    createdAt: row.createdAt.getTime(),
  }
}

export const listRooms = async (): Promise<RoomSummary[]> =>
  (await listOpenPublicRooms(50)).map(toSummary)

export const getMyActiveRoom = async (hostId: string): Promise<RoomSummary | null> => {
  const row = await findActiveRoomOfHost(hostId)
  return row ? toSummary(row) : null
}
