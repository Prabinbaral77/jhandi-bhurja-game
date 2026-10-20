import { authRouter } from '#controllers/authRouter'
import { healthRouter } from '#controllers/healthRouter'
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
})

export type AppRouter = typeof appRouter
