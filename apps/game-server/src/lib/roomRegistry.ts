import { matchMaker } from '@colyseus/core'

// Is a JhandiRoom for this DB room running on any node right now? (Redis driver = all nodes.)
export const isRoomLive = async (dbRoomId: string): Promise<boolean> => {
  const rooms = await matchMaker.query({ name: 'jhandi', dbRoomId } as Record<string, unknown>)
  return rooms.length > 0
}
