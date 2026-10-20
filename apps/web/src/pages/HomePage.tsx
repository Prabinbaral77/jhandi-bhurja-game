import { useQuery } from '@tanstack/react-query'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import DailyBonusCard from '@/components/DailyBonusCard'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

export default function HomePage() {
  const t = useT()
  const trpc = useTRPC()
  const wallet = useQuery(trpc.wallet.get.queryOptions())

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-brick/30 p-6">
        <p className="text-sm text-cream/70">{t('balance')}</p>
        {wallet.data && (
          <CoinAmount amount={wallet.data.balance} className="text-4xl font-bold text-marigold" />
        )}
      </section>
      <DailyBonusCard />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Lobby and hosting arrive in M3/M4. */}
        <Button variant="secondary" disabled title={t('comingSoon')}>
          {t('welcomePlay')} · {t('comingSoon')}
        </Button>
        <Button variant="secondary" disabled title={t('comingSoon')}>
          {t('welcomeHost')} · {t('comingSoon')}
        </Button>
      </div>
    </div>
  )
}
