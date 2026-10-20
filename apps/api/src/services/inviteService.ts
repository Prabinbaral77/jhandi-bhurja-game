import type { DbOrTx } from '@jhandi/db/database'
import { UNIQUE_VIOLATION, pgErrorCode } from '@jhandi/ledger/pgError'
import { AppError } from '@jhandi/protocol/appError'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type Invite,
  type InvitePreview,
} from '@jhandi/protocol/room'
import { randomBytes, randomInt } from 'node:crypto'
import { db } from '#lib/db'
import { env } from '#lib/env'
import {
  countInvitedMembers,
  findMembership,
  findRoomByInvite,
  findRoomForHost,
  grantInvitedAccess,
  insertInvite,
  revokeInvites,
} from '#repositories/inviteRepository'
import { getSettings } from '#services/settingsService'
import { hashSecret } from '#utils/crypto'
import { createRateLimiter } from '#utils/rateLimiter'

// Brute-force guard for typed codes: 31^6 ≈ 887 M codes vs 5 tries per 10 min per user.
const codeUserLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })
const codeIpLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 })
const MAX_CODE_RETRIES = 5

const tokenHash = (token: string) => hashSecret(`invite-token:${token}`)
const codeHash = (code: string) => hashSecret(`invite-code:${code}`)

const randomCode = (): string =>
  Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
  ).join('')

export const inviteLinkFor = (token: string): string => `${env.WEB_ORIGIN}/r/${token}`

// Creates the room's single active invite; retries on the (rare) code-hash collision.
export const issueInvite = async (tx: DbOrTx, roomId: string, hostId: string): Promise<Invite> => {
  await revokeInvites(tx, roomId)
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const token = randomBytes(16).toString('base64url')
    const code = randomCode()
    try {
      await insertInvite(tx, {
        roomId,
        tokenHash: tokenHash(token),
        codeHash: codeHash(code),
        createdBy: hostId,
      })
      return { inviteLink: inviteLinkFor(token), roomCode: code }
    } catch (error) {
      if (pgErrorCode(error) !== UNIQUE_VIOLATION) throw error
    }
  }
  throw new Error('Could not generate a unique room code')
}

export const resetInvite = async (roomId: string, hostId: string): Promise<Invite> => {
  const room = await findRoomForHost(roomId, hostId)
  if (!room) throw new AppError('FORBIDDEN', 'Only the host can reset the invite')
  if (room.visibility !== 'PRIVATE') throw new AppError('VALIDATION_FAILED', 'Room is not private')
  if (room.status === 'CLOSED') throw new AppError('ROOM_CLOSED', 'Room is closed')
  return db.transaction((tx) => issueInvite(tx, roomId, hostId))
}

type InvitedRoom = NonNullable<Awaited<ReturnType<typeof findRoomByInvite>>>

const toPreview = async (room: InvitedRoom, userId: string): Promise<InvitePreview> => {
  const [members, membership, settings] = await Promise.all([
    countInvitedMembers(room.id),
    findMembership(room.id, userId),
    getSettings(),
  ])
  const joined =
    room.hostId === userId || (membership?.access === 'INVITED' && membership.removedAt === null)
  return {
    roomId: room.id,
    name: room.name,
    host: { id: room.hostId, displayName: room.hostName },
    members,
    maxMembers: room.maxMembers ?? settings.PRIVATE_ROOM_MAX_MEMBERS,
    joined,
  }
}

// Resolve link/code → room and give the caller INVITED access (docs/architecture.md §5.6).
const accept = async (room: InvitedRoom | undefined, userId: string): Promise<InvitePreview> => {
  if (!room || room.status === 'CLOSED')
    throw new AppError('INVALID_CODE', 'This invite is not valid any more')
  const preview = await toPreview(room, userId)
  if (preview.joined) return preview
  if (room.isLocked) throw new AppError('ROOM_LOCKED', 'The host has locked this room')
  if (preview.members >= preview.maxMembers) throw new AppError('ROOM_FULL', 'This room is full')
  await grantInvitedAccess(room.id, userId)
  return { ...preview, members: preview.members + 1, joined: true }
}

export const acceptInviteLink = (token: string, userId: string): Promise<InvitePreview> =>
  findRoomByInvite({ tokenHash: tokenHash(token) }).then((room) => accept(room, userId))

export const acceptRoomCode = async (
  code: string,
  userId: string,
  ip: string,
): Promise<InvitePreview> => {
  const wait = Math.max(codeUserLimiter.hit(userId), codeIpLimiter.hit(ip))
  if (wait > 0)
    throw new AppError('RATE_LIMITED', 'Too many attempts, please wait', { retryAfterMs: wait })
  return accept(await findRoomByInvite({ codeHash: codeHash(code) }), userId)
}
