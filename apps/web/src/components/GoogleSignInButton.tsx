import { useEffect, useRef } from 'react'
import { env } from '@/lib/env'

interface GoogleId {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, options: Record<string, string | number>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Google script failed to load'))
    }
    document.head.appendChild(script)
  })

// Renders only when VITE_GOOGLE_CLIENT_ID is set and the API has Google enabled.
export default function GoogleSignInButton({
  onCredential,
}: {
  onCredential: (idToken: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const clientId = env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadScript()
      .then(() => {
        const google = window.google
        if (cancelled || !google || !container.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            onCredential(credential)
          },
        })
        google.accounts.id.renderButton(container.current, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  if (!clientId) return null
  return <div ref={container} className="flex justify-center" />
}
