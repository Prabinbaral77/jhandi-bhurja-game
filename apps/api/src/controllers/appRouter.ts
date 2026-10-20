import { router } from '#lib/trpc'
import { healthRouter } from '#controllers/healthRouter'

export const appRouter = router({
  health: healthRouter,
})

export type AppRouter = typeof appRouter
