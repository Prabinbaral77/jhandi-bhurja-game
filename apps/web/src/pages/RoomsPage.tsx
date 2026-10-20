import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'
import { formatCoins } from '@/utils/format'

// Plain list of open rooms; the live lobby with player counts arrives in M4.
export default function RoomsPage() {
  const t = useT()
  const trpc = useTRPC()
  const rooms = useQuery({ ...trpc.rooms.list.queryOptions(), refetchInterval: 10_000 })
  const mine = useQuery(trpc.rooms.mine.queryOptions())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('rooms')}</h1>
        {mine.data ? (
          <Link
            to={`/room/${mine.data.roomId}`}
            className="rounded-lg bg-marigold px-4 py-2 font-semibold text-wood"
          >
            {t('goToMyRoom')}
          </Link>
        ) : (
          <Link to="/host/new" className="rounded-lg bg-marigold px-4 py-2 font-semibold text-wood">
            {t('hostRoom')}
          </Link>
        )}
      </div>
      {rooms.data?.length === 0 && <p className="text-cream/60">{t('noRooms')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {rooms.data?.map((room) => (
          <li key={room.roomId}>
            <Link
              to={`/room/${room.roomId}`}
              className="flex flex-col gap-1 rounded-xl border border-cream/15 p-4 hover:border-marigold"
            >
              <span className="text-lg font-semibold">{room.name}</span>
              <span className="text-sm text-cream/70">
                {t('host')}: {room.host.displayName}
              </span>
              <span className="text-sm text-cream/60">
                {t('minBet')}: {formatCoins(room.minBet)} · {t(`phase.${room.status}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
