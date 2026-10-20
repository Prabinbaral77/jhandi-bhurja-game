import type { AppRouter } from '@jhandi/api/controllers/appRouter'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { env } from '@/lib/env'
import { getValidAccessToken, withCookies } from '@/lib/session'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

export const createApiClient = () =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${env.VITE_API_URL}/v1/trpc`,
        // Cookies are needed for sign-in calls, which set the refresh cookie.
        fetch: withCookies,
        headers: async () => {
          const token = await getValidAccessToken()
          return token ? { authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
