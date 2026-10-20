import { useEffect } from 'react'
import { refreshSession } from '@/lib/session'

// On page load, turn the httpOnly refresh cookie (if any) into an in-memory session.
export const useBootstrapSession = (): void => {
  useEffect(() => {
    void refreshSession()
  }, [])
}
