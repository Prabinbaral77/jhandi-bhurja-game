import { useLocation, useNavigate } from 'react-router'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import { useAuthStore } from '@/lib/authStore'
import { useT } from '@/lib/i18n'

// Shown once after sign-up (docs/architecture.md §2.6 first-time user journey).
export default function WelcomePage() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuthStore((s) => s.auth)
  const bonus = (location.state as { signupBonus?: number } | null)?.signupBonus ?? 0
  const name = auth.status === 'signedIn' ? auth.user.displayName : ''

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 text-center">
      <h1 className="text-3xl font-bold text-marigold">{t('welcomeTitle', { name })}</h1>
      {bonus > 0 && (
        <section className="rounded-2xl border border-brass/50 bg-brass/10 p-6">
          <p className="text-cream/80">{t('welcomeBonus')}</p>
          <CoinAmount amount={bonus} className="mt-2 text-5xl font-bold text-marigold" />
          <p className="mt-1 text-cream/60">{t('coins')}</p>
        </section>
      )}
      <div className="grid gap-3 text-left sm:grid-cols-2">
        <section className="rounded-xl border border-cream/15 p-4">
          <h2 className="font-semibold">{t('welcomePlay')}</h2>
          <p className="mt-1 text-sm text-cream/70">{t('welcomePlayHint')}</p>
        </section>
        <section className="rounded-xl border border-cream/15 p-4">
          <h2 className="font-semibold">{t('welcomeHost')}</h2>
          <p className="mt-1 text-sm text-cream/70">{t('welcomeHostHint')}</p>
        </section>
      </div>
      <Button onClick={() => void navigate('/', { replace: true })}>{t('continue')}</Button>
    </div>
  )
}
