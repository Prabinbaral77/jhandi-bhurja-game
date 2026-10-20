import type { DbOrTx } from '@jhandi/db/database'
import { newId } from '@jhandi/db/ids'
import { roomInvites } from '@jhandi/db/schema/invites'
import { roomMembers, rooms } from '@jhandi/db/schema/rooms'
import { users } from '@jhandi/db/schema/users'
import { and, count, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '#lib/db'

export const insertInvite = async (
  tx: DbOrTx,
  input: { roomId: string; tokenHash: string; codeHash: string; createdBy: string },
) => {
  await tx.insert(roomInvites).values({ id: newId(), ...input })
}

export const revokeInvites = async (tx: DbOrTx, roomId: string) => {
  await tx
    .update(roomInvites)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(roomInvites.roomId, roomId), isNull(roomInvites.revokedAt)))
}

const roomWithHost = {
  id: rooms.id,
  name: rooms.name,
  visibility: rooms.visibility,
  status: rooms.status,
  isLocked: rooms.isLocked,
  maxMembers: rooms.maxMembers,
  hostId: rooms.hostId,
  hostName: users.displayName,
}

// Active invite → its room, by hashed link token or hashed code.
export const findRoomByInvite = async (by: { tokenHash: string } | { codeHash: string }) => {
  const match =
    'tokenHash' in by
      ? eq(roomInvites.tokenHash, by.tokenHash)
      : eq(roomInvites.codeHash, by.codeHash)
  const [row] = await db
    .select(roomWithHost)
    .from(roomInvites)
    .innerJoin(rooms, eq(rooms.id, roomInvites.roomId))
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(and(match, isNull(roomInvites.revokedAt)))
  return row
}

export const findRoomForHost = async (roomId: string, hostId: string) => {
  const [row] = await db
    .select(roomWithHost)
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(and(eq(rooms.id, roomId), eq(rooms.hostId, hostId)))
  return row
}

// Invited, not removed, not the host.
export const countInvitedMembers = async (roomId: string): Promise<number> => {
  const [row] = await db
    .select({ n: count() })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.access, 'INVITED'),
        ne(roomMembers.role, 'HOST'),
        isNull(roomMembers.removedAt),
      ),
    )
  return row?.n ?? 0
}

export const findMembership = async (roomId: string, userId: string) => {
  const [row] = await db
    .select({
      access: roomMembers.access,
      removedAt: roomMembers.removedAt,
      role: roomMembers.role,
    })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
  return row
}

// Grants access; a previously removed user is re-admitted (host's choice to share the code again).
export const grantInvitedAccess = async (roomId: string, userId: string) => {
  await db
    .insert(roomMembers)
    .values({ roomId, userId, role: 'SPECTATOR', access: 'INVITED' })
    .onConflictDoUpdate({
      target: [roomMembers.roomId, roomMembers.userId],
      set: { access: 'INVITED', removedAt: null },
    })
}
