import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import ErrorText from '@/components/ErrorText'
import { useLanguageStore, useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'
import { formatDateTime } from '@/utils/format'

export default function DailyBonusCard() {
  const t = useT()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const language = useLanguageStore((s) => s.language)
  const wallet = useQuery(trpc.wallet.get.queryOptions())
  const claim = useMutation(
    trpc.wallet.claimDailyBonus.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.wallet.pathKey() })
      },
    }),
  )

  if (!wallet.data) return null
  const { dailyBonusAvailable, dailyBonusAmount, nextDailyBonusAt } = wallet.data

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/40 bg-brass/10 p-4">
      <div>
        <h2 className="font-semibold">{t('dailyBonus')}</h2>
        {dailyBonusAvailable ? (
          <CoinAmount amount={dailyBonusAmount} className="text-lg text-marigold" />
        ) : (
          <p className="text-sm text-cream/70">
            {t('claimed')}
            {nextDailyBonusAt !== null &&
              ` · ${t('nextBonusAt', { time: formatDateTime(nextDailyBonusAt, language) })}`}
          </p>
        )}
        <ErrorText error={claim.error} />
      </div>
      {dailyBonusAvailable && (
        <Button
          disabled={claim.isPending}
          onClick={() => {
            claim.mutate()
          }}
        >
          {t('claim')}
        </Button>
      )}
    </section>
  )
}
