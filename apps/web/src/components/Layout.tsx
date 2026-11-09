import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import Garland from '@/components/art/Garland'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import SoundToggle from '@/components/SoundToggle'
import { useSessionReminder } from '@/hooks/useSessionReminder'
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
  const reminder = useSessionReminder(auth.status === 'signedIn')
  const wallet = useQuery({
    ...trpc.wallet.get.queryOptions(),
    enabled: auth.status === 'signedIn',
  })

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col overflow-x-clip px-4">
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
          <SoundToggle />
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
      <Garland />
      {auth.status === 'signedIn' && (
        <nav className="flex items-center gap-1 py-2">
          <NavLink to="/" end className={navClass}>
            {t('home')}
          </NavLink>
          <NavLink to="/rooms" className={navClass}>
            {t('rooms')}
          </NavLink>
          <NavLink to="/wallet" className={navClass}>
            {t('wallet')}
          </NavLink>
          {auth.user.isAdmin && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
          <span className="ml-auto truncate text-sm text-cream/60">{auth.user.displayName}</span>
          <Button variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => void logout()}>
            {t('logout')}
          </Button>
        </nav>
      )}
      {reminder.hours > 0 && (
        <div
          role="status"
          className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-marigold/40 bg-marigold/10 px-3 py-2 text-sm"
        >
          <span>{t('sessionReminder', { h: reminder.hours })}</span>
          <Button variant="ghost" className="min-h-8 px-2 text-sm" onClick={reminder.dismiss}>
            {t('ok')}
          </Button>
        </div>
      )}
      <main className="flex-1 py-6">{children}</main>
      <footer className="flex flex-col gap-1 border-t border-cream/10 py-3 text-xs text-cream/50">
        <p className="text-cream/70">{t('credit')}</p>
        <p>{t('noCashValue')}</p>
        <p className="flex flex-wrap gap-x-3">
          <Link to="/legal/terms" className="hover:underline">
            {t('terms')}
          </Link>
          <Link to="/legal/privacy" className="hover:underline">
            {t('privacy')}
          </Link>
          <Link to="/legal/responsible-play" className="hover:underline">
            {t('responsiblePlay')}
          </Link>
        </p>
      </footer>
    </div>
  )
}
