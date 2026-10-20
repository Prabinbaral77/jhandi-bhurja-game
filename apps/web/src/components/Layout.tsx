import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import { useAuthStore } from '@/lib/authStore'
import { useLanguageStore, useT } from '@/lib/i18n'
import { logout } from '@/lib/session'
import { useTRPC } from '@/lib/trpc'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-cream/10 text-cream' : 'text-cream/70 hover:text-cream'}`

export default function Layout({ children }: { children: ReactNode }) {
  const t = useT()
  const trpc = useTRPC()
  const auth = useAuthStore((s) => s.auth)
  const { language, setLanguage } = useLanguageStore()
  const wallet = useQuery({
    ...trpc.wallet.get.queryOptions(),
    enabled: auth.status === 'signedIn',
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cream/10 py-3">
        <Link to="/" className="text-xl font-bold text-marigold">
          {t('appName')}
        </Link>
        <div className="flex items-center gap-2">
          {wallet.data && (
            <Link to="/wallet" className="rounded-full bg-cream/10 px-3 py-1 font-semibold">
              <CoinAmount amount={wallet.data.balance} />
            </Link>
          )}
          <Button
            variant="ghost"
            className="min-h-9 px-2 text-sm"
            onClick={() => {
              setLanguage(language === 'ne' ? 'en' : 'ne')
            }}
          >
            {language === 'ne' ? 'EN' : 'ने'}
          </Button>
        </div>
      </header>
      {auth.status === 'signedIn' && (
        <nav className="flex items-center gap-1 py-2">
          <NavLink to="/" end className={navClass}>
            {t('home')}
          </NavLink>
          <NavLink to="/wallet" className={navClass}>
            {t('wallet')}
          </NavLink>
          <span className="ml-auto truncate text-sm text-cream/60">{auth.user.displayName}</span>
          <Button variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => void logout()}>
            {t('logout')}
          </Button>
        </nav>
      )}
      <main className="flex-1 py-6">{children}</main>
    </div>
  )
}
