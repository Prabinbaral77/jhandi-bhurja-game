import { updateMeInputSchema, userSchema } from '@jhandi/protocol/user'
import { protectedProcedure, router } from '#lib/trpc'
import { getMe, updateMe } from '#services/userService'

export const meRouter = router({
  get: protectedProcedure.output(userSchema).query(({ ctx }) => getMe(ctx.userId)),
  update: protectedProcedure
    .input(updateMeInputSchema)
    .output(userSchema)
    .mutation(({ ctx, input }) => updateMe(ctx.userId, input)),
})
