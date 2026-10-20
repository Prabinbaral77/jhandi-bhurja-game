import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/lib/authStore'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.auth.status)
  const location = useLocation()

  if (status === 'loading') {
    return <div className="grid min-h-dvh place-items-center text-cream/60">…</div>
  }
  if (status === 'signedOut') {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return children
}
