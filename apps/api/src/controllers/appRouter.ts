import { adminRouter } from '#controllers/adminRouter'
import { authRouter } from '#controllers/authRouter'
import { healthRouter } from '#controllers/healthRouter'
import { inviteRouter } from '#controllers/inviteRouter'
import { meRouter } from '#controllers/meRouter'
import { roomsRouter } from '#controllers/roomsRouter'
import { walletRouter } from '#controllers/walletRouter'
import { router } from '#lib/trpc'

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  me: meRouter,
  wallet: walletRouter,
  rooms: roomsRouter,
  invite: inviteRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
