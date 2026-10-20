import { roomMembers, rooms } from '@jhandi/db/schema/rooms'
import { users } from '@jhandi/db/schema/users'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '#lib/db'

export const findRoom = async (roomId: string) => {
  const [row] = await db
    .select({ room: rooms, hostName: users.displayName })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(eq(rooms.id, roomId))
  return row
}

export const findUser = async (userId: string) => {
  const [row] = await db
    .select({ id: users.id, displayName: users.displayName, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
  return row
}

export const upsertMember = async (
  roomId: string,
  userId: string,
  role: 'HOST' | 'PLAYER' | 'SPECTATOR',
) => {
  await db
    .insert(roomMembers)
    .values({ roomId, userId, role })
    .onConflictDoUpdate({
      target: [roomMembers.roomId, roomMembers.userId],
      set: { role, leftAt: null },
    })
}

export const markMemberLeft = async (roomId: string, userId: string) => {
  await db
    .update(roomMembers)
    .set({ leftAt: sql`now()` })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
}

export const setRoomStatus = async (roomId: string, status: 'OPEN' | 'PAUSED' | 'CLOSED') => {
  await db
    .update(rooms)
    .set({ status, ...(status === 'CLOSED' ? { closedAt: sql`now()` } : {}) })
    .where(eq(rooms.id, roomId))
}
