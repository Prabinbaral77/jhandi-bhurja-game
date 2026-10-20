import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import type { RoomSnapshot } from '@jhandi/protocol/room'
import { SYMBOL_COLOR, SYMBOL_GLYPH } from '@/components/room/symbolStyle'
import { useT } from '@/lib/i18n'
import { formatCoins } from '@/utils/format'

interface BoardProps {
  snapshot: RoomSnapshot
  myBets: Partial<Record<GameSymbol, number>>
  canBet: boolean
  onBet: (symbol: GameSymbol) => void
  onCancel: (symbol: GameSymbol) => void
}

const tileBase =
  'relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 transition-transform'

export default function Board({ snapshot, myBets, canBet, onBet, onCancel }: BoardProps) {
  const t = useT()
  const winning = new Set(
    snapshot.phase === 'RESULT' || snapshot.phase === 'ROLLING'
      ? SYMBOLS.filter((s) => snapshot.lastDice.filter((d) => d === s).length >= 2)
      : [],
  )

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {SYMBOLS.map((symbol) => {
        const tile = snapshot.board[symbol] ?? { total: 0, bettors: 0 }
        const mine = myBets[symbol] ?? 0
        const highlight = winning.has(symbol)
          ? 'border-marigold bg-marigold/20 scale-[1.03]'
          : 'border-brass/40 bg-brick/25'
        return (
          <div key={symbol} className="relative">
            <button
              type="button"
              disabled={!canBet}
              onClick={() => {
                onBet(symbol)
              }}
              className={`${tileBase} ${highlight} w-full enabled:hover:border-marigold enabled:active:scale-95 disabled:cursor-default`}
            >
              <span className={`text-4xl sm:text-5xl ${SYMBOL_COLOR[symbol]}`} aria-hidden>
                {SYMBOL_GLYPH[symbol]}
              </span>
              <span className="text-sm font-semibold">{t(`symbol.${symbol}`)}</span>
              <span className="text-xs text-cream/70 tabular-nums">
                {formatCoins(tile.total)} · {tile.bettors}👤
              </span>
            </button>
            {mine > 0 && (
              <div className="absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-marigold px-2 py-0.5 text-xs font-bold text-wood">
                {t('yourBet')} {formatCoins(mine)}
                {canBet && (
                  <button
                    type="button"
                    aria-label={t('cancel')}
                    className="ml-0.5 rounded-full px-1 hover:bg-wood/20"
                    onClick={() => {
                      onCancel(symbol)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
