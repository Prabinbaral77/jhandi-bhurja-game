import type { RoomLiveSummary } from '@jhandi/protocol/lobby'
import type { RoomSummary } from '@jhandi/protocol/room'
import { Link } from 'react-router'
import { SYMBOL_GLYPH } from '@/components/room/symbolStyle'
import { useT } from '@/lib/i18n'
import { formatCoins } from '@/utils/format'

export interface LobbyRoom {
  base: RoomSummary
  live: RoomLiveSummary | undefined
}

export default function RoomCard({ room }: { room: LobbyRoom }) {
  const t = useT()
  const { base, live } = room
  const phase = live?.phase ?? base.status
  const phaseTone =
    phase === 'BETTING'
      ? 'text-jamara'
      : phase === 'PAUSED' || phase === 'OPEN'
        ? 'text-cream/60'
        : 'text-marigold'

  return (
    <Link
      to={`/room/${base.roomId}`}
      className="flex flex-col gap-2 rounded-xl border border-cream/15 p-4 hover:border-marigold"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{base.name}</h2>
          <p className="text-sm text-cream/70">
            {t('host')}: {live?.hostName ?? base.host.displayName}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${phaseTone}`}>
          {t(`phase.${phase}`)}
          {live && live.roundNo > 0 && ` · #${live.roundNo}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-cream/80 tabular-nums">
        <span>
          👤 {live?.players ?? 0} {t('player')} · 👁 {live?.spectators ?? 0}
        </span>
        <span>
          {t('bank')}: {formatCoins(live?.bankBalance ?? 0)}
        </span>
        <span>
          {t('minBet')}: {formatCoins(base.minBet)}
        </span>
        {live && live.volumeLast10Min > 0 && (
          <span>
            {t('volume10m')}: {formatCoins(live.volumeLast10Min)}
          </span>
        )}
      </div>

      {live && live.lastResults.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('lastResults')}>
          {live.lastResults.map((dice, i) => (
            <li key={i} className="rounded-md bg-cream/10 px-1.5 py-0.5 text-sm tracking-wide">
              {dice.map((d) => SYMBOL_GLYPH[d]).join('')}
            </li>
          ))}
        </ul>
      )}
      {!live && <p className="text-xs text-cream/50">{t('roomIdle')}</p>}
    </Link>
  )
}
