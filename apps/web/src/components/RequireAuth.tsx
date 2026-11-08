import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/lib/authStore'
import { useT } from '@/lib/i18n'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.auth.status)
  const location = useLocation()
  const t = useT()

  if (status === 'loading') {
    // The session check waits for the API; on free hosting a sleeping server takes up to a
    // minute to wake, so say so instead of showing an empty page.
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-cream/70">
        <span
          className="size-8 animate-spin rounded-full border-2 border-marigold border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">{t('serverWaking')}</p>
      </div>
    )
  }
  if (status === 'signedOut') {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return children
}
