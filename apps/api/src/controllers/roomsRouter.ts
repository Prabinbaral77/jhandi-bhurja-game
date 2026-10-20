import {
  createRoomInputSchema,
  createRoomOutputSchema,
  roomSummarySchema,
} from '@jhandi/protocol/room'
import { z } from 'zod'
import { protectedProcedure, router } from '#lib/trpc'
import { createRoom, getMyActiveRoom, listRooms } from '#services/roomService'

export const roomsRouter = router({
  create: protectedProcedure
    .input(createRoomInputSchema)
    .output(createRoomOutputSchema)
    .mutation(({ ctx, input }) => createRoom(ctx.userId, input)),
  list: protectedProcedure.output(z.array(roomSummarySchema)).query(() => listRooms()),
  mine: protectedProcedure
    .output(roomSummarySchema.nullable())
    .query(({ ctx }) => getMyActiveRoom(ctx.userId)),
})
