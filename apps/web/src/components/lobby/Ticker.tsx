import type { TickerItem } from '@jhandi/protocol/lobby'
import { useT } from '@/lib/i18n'
import { formatCoins } from '@/utils/format'

export default function Ticker({ items }: { items: TickerItem[] }) {
  const t = useT()
  if (items.length === 0) return null
  return (
    <div className="overflow-hidden rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-2 text-sm">
      <ul className="flex gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        {items.map((item) => (
          <li key={item.id}>
            🎉{' '}
            {t('ticker.win', {
              name: item.displayName,
              n: formatCoins(item.won),
              symbol: t(`symbol.${item.symbol}`),
              k: item.matches,
              room: item.roomName,
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}
