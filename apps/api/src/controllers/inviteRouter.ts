import { invitePreviewSchema, inviteSchema, roomCodeSchema } from '@jhandi/protocol/room'
import { z } from 'zod'
import { protectedProcedure, router } from '#lib/trpc'
import { acceptInviteLink, acceptRoomCode, resetInvite } from '#services/inviteService'

export const inviteRouter = router({
  // Opening an invite link grants access; the web then joins the room.
  accept: protectedProcedure
    .input(z.object({ inviteToken: z.string().min(8).max(64) }))
    .output(invitePreviewSchema)
    .mutation(({ ctx, input }) => acceptInviteLink(input.inviteToken, ctx.userId)),
  joinByCode: protectedProcedure
    .input(z.object({ roomCode: roomCodeSchema }))
    .output(invitePreviewSchema)
    .mutation(({ ctx, input }) => acceptRoomCode(input.roomCode, ctx.userId, ctx.ip)),
  reset: protectedProcedure
    .input(z.object({ roomId: z.uuid() }))
    .output(inviteSchema)
    .mutation(({ ctx, input }) => resetInvite(input.roomId, ctx.userId)),
})
