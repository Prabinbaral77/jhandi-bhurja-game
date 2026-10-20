import { useQuery } from '@tanstack/react-query'
import CoinAmount from '@/components/CoinAmount'
import DailyBonusCard from '@/components/DailyBonusCard'
import TransactionList from '@/components/TransactionList'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

export default function WalletPage() {
  const t = useT()
  const trpc = useTRPC()
  const wallet = useQuery(trpc.wallet.get.queryOptions())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('wallet')}</h1>
      <section className="rounded-2xl bg-brick/30 p-6">
        <p className="text-sm text-cream/70">{t('balance')}</p>
        {wallet.data && (
          <CoinAmount amount={wallet.data.balance} className="text-4xl font-bold text-marigold" />
        )}
      </section>
      <DailyBonusCard />
      <h2 className="mt-2 text-lg font-semibold">{t('history')}</h2>
      <TransactionList />
    </div>
  )
}
