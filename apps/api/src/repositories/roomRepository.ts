import type { DbOrTx } from '@jhandi/db/database'
import { roomMembers, rooms } from '@jhandi/db/schema/rooms'
import { users } from '@jhandi/db/schema/users'
import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '#lib/db'

export const insertRoom = async (tx: DbOrTx, room: typeof rooms.$inferInsert) => {
  await tx.insert(rooms).values(room)
  await tx.insert(roomMembers).values({ roomId: room.id, userId: room.hostId, role: 'HOST' })
}

const summaryColumns = {
  id: rooms.id,
  name: rooms.name,
  venue: rooms.venue,
  status: rooms.status,
  config: rooms.config,
  createdAt: rooms.createdAt,
  hostId: users.id,
  hostName: users.displayName,
}

// Full live lobby comes in M4; this is a plain list of open public rooms.
export const listOpenPublicRooms = async (limit: number) =>
  db
    .select(summaryColumns)
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(and(ne(rooms.status, 'CLOSED'), eq(rooms.visibility, 'PUBLIC')))
    .orderBy(desc(rooms.createdAt))
    .limit(limit)

export const findActiveRoomOfHost = async (hostId: string) => {
  const [row] = await db
    .select(summaryColumns)
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .where(and(eq(rooms.hostId, hostId), ne(rooms.status, 'CLOSED')))
  return row
}
