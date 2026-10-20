import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import CoinAmount from '@/components/CoinAmount'
import DailyBonusCard from '@/components/DailyBonusCard'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

const cardClass = 'flex flex-col gap-1 rounded-xl border border-cream/15 p-4 hover:border-marigold'

export default function HomePage() {
  const t = useT()
  const trpc = useTRPC()
  const wallet = useQuery(trpc.wallet.get.queryOptions())
  const mine = useQuery(trpc.rooms.mine.queryOptions())

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
        <Link to="/rooms" className={cardClass}>
          <span className="text-lg font-semibold">{t('welcomePlay')}</span>
          <span className="text-sm text-cream/70">{t('welcomePlayHint')}</span>
        </Link>
        <Link to={mine.data ? `/room/${mine.data.roomId}` : '/host/new'} className={cardClass}>
          <span className="text-lg font-semibold">
            {mine.data ? t('goToMyRoom') : t('welcomeHost')}
          </span>
          <span className="text-sm text-cream/70">
            {mine.data ? mine.data.name : t('welcomeHostHint')}
          </span>
        </Link>
      </div>
    </div>
  )
}
