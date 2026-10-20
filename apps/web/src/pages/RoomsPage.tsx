import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import RoomCard, { type LobbyRoom } from '@/components/lobby/RoomCard'
import Ticker from '@/components/lobby/Ticker'
import { useLobby } from '@/hooks/useLobby'
import { useT, type MessageKey } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

type Sort = 'players' | 'volume' | 'newest'
type BetRange = 'all' | 'low' | 'mid' | 'high'

const SORTS: { value: Sort; key: MessageKey }[] = [
  { value: 'players', key: 'sort.players' },
  { value: 'volume', key: 'sort.volume' },
  { value: 'newest', key: 'sort.newest' },
]
const RANGES: { value: BetRange; key: MessageKey; test: (minBet: number) => boolean }[] = [
  { value: 'all', key: 'range.all', test: () => true },
  { value: 'low', key: 'range.low', test: (m) => m <= 20 },
  { value: 'mid', key: 'range.mid', test: (m) => m > 20 && m <= 100 },
  { value: 'high', key: 'range.high', test: (m) => m > 100 },
]

const chip = (active: boolean) =>
  `rounded-full px-3 py-1 text-sm ${active ? 'bg-marigold text-wood' : 'bg-cream/10 text-cream/80 hover:bg-cream/20'}`

// Lobby: open rooms from the API, enriched live (players, phase, results, volume) from the game
// server's lobby room (docs/architecture.md §5.3).
export default function RoomsPage() {
  const t = useT()
  const trpc = useTRPC()
  const rooms = useQuery({ ...trpc.rooms.list.queryOptions(), refetchInterval: 30_000 })
  const mine = useQuery(trpc.rooms.mine.queryOptions())
  const lobby = useLobby()
  const [sort, setSort] = useState<Sort>('players')
  const [range, setRange] = useState<BetRange>('all')

  const list = useMemo<LobbyRoom[]>(() => {
    const inRange = RANGES.find((r) => r.value === range)?.test ?? (() => true)
    const merged = (rooms.data ?? [])
      .filter((base) => inRange(base.minBet))
      .map((base) => ({ base, live: lobby.live[base.roomId] }))
    const by: Record<Sort, (a: LobbyRoom, b: LobbyRoom) => number> = {
      players: (a, b) => (b.live?.players ?? 0) - (a.live?.players ?? 0),
      volume: (a, b) => (b.live?.volumeLast10Min ?? 0) - (a.live?.volumeLast10Min ?? 0),
      newest: (a, b) => b.base.createdAt - a.base.createdAt,
    }
    return merged.sort((a, b) => by[sort](a, b) || b.base.createdAt - a.base.createdAt)
  }, [rooms.data, lobby.live, sort, range])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {t('rooms')}{' '}
          <span className="text-base font-normal text-cream/50">
            {lobby.status === 'connected'
              ? `· ${t('live')}`
              : lobby.status === 'connecting'
                ? `· ${t('connecting')}`
                : ''}
          </span>
        </h1>
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

      <Ticker items={lobby.ticker} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-cream/60">{t('sortBy')}</span>
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={chip(sort === s.value)}
            onClick={() => {
              setSort(s.value)
            }}
          >
            {t(s.key)}
          </button>
        ))}
        <span className="ml-2 text-sm text-cream/60">{t('minBet')}</span>
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            className={chip(range === r.value)}
            onClick={() => {
              setRange(r.value)
            }}
          >
            {t(r.key)}
          </button>
        ))}
      </div>

      {rooms.data?.length === 0 && <p className="text-cream/60">{t('noRooms')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((room) => (
          <li key={room.base.roomId}>
            <RoomCard room={room} />
          </li>
        ))}
      </ul>
    </div>
  )
}
