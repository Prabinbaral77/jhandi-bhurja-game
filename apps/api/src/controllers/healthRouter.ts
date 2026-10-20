import { healthSchema } from '@jhandi/protocol/health'
import { publicProcedure, router } from '#lib/trpc'
import { getHealth } from '#services/healthService'

export const healthRouter = router({
  check: publicProcedure.output(healthSchema).query(() => getHealth()),
})
