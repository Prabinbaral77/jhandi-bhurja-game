import { authRouter } from '#controllers/authRouter'
import { healthRouter } from '#controllers/healthRouter'
import { meRouter } from '#controllers/meRouter'
import { walletRouter } from '#controllers/walletRouter'
import { router } from '#lib/trpc'

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  me: meRouter,
  wallet: walletRouter,
})

export type AppRouter = typeof appRouter
