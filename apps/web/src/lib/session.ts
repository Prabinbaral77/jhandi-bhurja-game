import type { AppRouter } from '@jhandi/api/controllers/appRouter'
import { createTRPCClient, httpLink } from '@trpc/client'
import { useAuthStore } from '@/lib/authStore'
import { env } from '@/lib/env'

const REFRESH_MARGIN_MS = 30_000

const withCookies: typeof fetch = (input, init) => fetch(input, { ...init, credentials: 'include' })

// Separate client without auth headers, so refreshing can never loop into itself.
const sessionClient = createTRPCClient<AppRouter>({
  links: [httpLink({ url: `${env.VITE_API_URL}/v1/trpc`, fetch: withCookies })],
})

let inFlight: Promise<string | null> | undefined

// Single-flight: many requests needing a fresh token share one refresh call.
export const refreshSession = (): Promise<string | null> => {
  inFlight ??= sessionClient.auth.refresh
    .mutate()
    .then((session) => {
      useAuthStore.getState().setSession(session)
      return session.accessToken
    })
    .catch(() => {
      useAuthStore.getState().signOut()
      return null
    })
    .finally(() => {
      inFlight = undefined
    })
  return inFlight
}

export const getValidAccessToken = async (): Promise<string | null> => {
  const { auth } = useAuthStore.getState()
  if (auth.status !== 'signedIn') return null
  if (auth.accessTokenExpiresAt - Date.now() > REFRESH_MARGIN_MS) return auth.accessToken
  return refreshSession()
}

export const logout = async (): Promise<void> => {
  try {
    await sessionClient.auth.logout.mutate()
  } finally {
    useAuthStore.getState().signOut()
  }
}

export { withCookies }
