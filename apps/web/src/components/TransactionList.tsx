import { useInfiniteQuery } from '@tanstack/react-query'
import Button from '@/components/Button'
import { useLanguageStore, useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'
import { formatDateTime, formatSignedCoins } from '@/utils/format'

export default function TransactionList() {
  const t = useT()
  const trpc = useTRPC()
  const language = useLanguageStore((s) => s.language)
  const history = useInfiniteQuery(
    trpc.wallet.transactions.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (page) => page.nextCursor ?? undefined },
    ),
  )

  const items = history.data?.pages.flatMap((page) => page.items) ?? []
  if (history.isSuccess && items.length === 0) {
    return <p className="text-cream/60">{t('noTransactions')}</p>
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-cream/10 rounded-xl border border-cream/10">
        {items.map((tx) => (
          <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{t(`tx.${tx.kind}`)}</p>
              <p className="text-xs text-cream/50">{formatDateTime(tx.createdAt, language)}</p>
            </div>
            <span
              className={`font-semibold tabular-nums ${tx.amount >= 0 ? 'text-jamara' : 'text-tika'}`}
            >
              {formatSignedCoins(tx.amount)}
            </span>
          </li>
        ))}
      </ul>
      {history.hasNextPage && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {t('loadMore')}
        </Button>
      )}
    </div>
  )
}
