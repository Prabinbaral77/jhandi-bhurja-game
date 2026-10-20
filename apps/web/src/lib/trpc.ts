import type { AppRouter } from '@jhandi/api/controllers/appRouter'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { env } from '@/lib/env'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

export const createApiClient = () =>
  createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${env.VITE_API_URL}/v1/trpc` })],
  })
