import type { PublicUser } from '@jhandi/protocol/user'
import { create } from 'zustand'

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: PublicUser; accessToken: string; accessTokenExpiresAt: number }

interface AuthStore {
  auth: AuthState
  setSession: (session: {
    user: PublicUser
    accessToken: string
    accessTokenExpiresAt: number
  }) => void
  setUser: (user: PublicUser) => void
  signOut: () => void
}

// The access token lives only in memory; the refresh token is an httpOnly cookie.
export const useAuthStore = create<AuthStore>((set) => ({
  auth: { status: 'loading' },
  setSession: (session) => {
    set({ auth: { status: 'signedIn', ...session } })
  },
  setUser: (user) => {
    set((state) => (state.auth.status === 'signedIn' ? { auth: { ...state.auth, user } } : state))
  },
  signOut: () => {
    set({ auth: { status: 'signedOut' } })
  },
}))
