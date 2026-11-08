import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import type { RoomSnapshot } from '@jhandi/protocol/room'
import Khal from '@/components/art/Khal'
import SymbolIcon from '@/components/art/SymbolIcon'
import { useT } from '@/lib/i18n'
import { formatCoins } from '@/utils/format'

interface BoardProps {
  snapshot: RoomSnapshot
  myBets: Partial<Record<GameSymbol, number>>
  canBet: boolean
  onBet: (symbol: GameSymbol) => void
  onCancel: (symbol: GameSymbol) => void
  // Tapped a tile while betting is not possible: the page explains why.
  onBlocked: () => void
}

// Carved wooden frame (tunal-style) around each symbol tile.
const tileBase =
  'relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-[3px] p-2 transition-transform ' +
  'bg-[linear-gradient(135deg,#f6d35e,#dfb73f)] shadow-[inset_0_0_0_3px_#8a5a32,inset_0_0_0_5px_#c9a23a,0_4px_10px_rgba(0,0,0,0.45)]'

export default function Board({
  snapshot,
  myBets,
  canBet,
  onBet,
  onCancel,
  onBlocked,
}: BoardProps) {
  const t = useT()
  // The last throw stays marked on the board until the host starts the next round (the server
  // clears `lastDice` then): green blink for pairs or better, faint red for every other symbol.
  const showing =
    snapshot.lastDice.length === 6 &&
    (snapshot.phase === 'RESULT' || snapshot.phase === 'OPEN' || snapshot.phase === 'PAUSED')
  const matches = (symbol: GameSymbol) => snapshot.lastDice.filter((d) => d === symbol).length

  return (
    <Khal>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {SYMBOLS.map((symbol) => {
          const tile = snapshot.board[symbol] ?? { total: 0, bettors: 0 }
          const mine = myBets[symbol] ?? 0
          const k = showing ? matches(symbol) : 0
          const won = k >= 2
          const lost = showing && !won
          const frame = won
            ? 'border-jamara scale-[1.04]'
            : lost
              ? 'border-tika/70'
              : 'border-[#5c3a1e]'
          return (
            <div key={symbol} className="relative">
              <button
                type="button"
                aria-disabled={!canBet}
                onClick={() => {
                  if (canBet) onBet(symbol)
                  else onBlocked()
                }}
                className={`${tileBase} ${frame} ${canBet ? 'hover:border-marigold active:scale-95' : 'cursor-default'}`}
              >
                {won && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[9px] bg-jamara motion-safe:animate-[win-blink_0.8s_ease-in-out_infinite]"
                  />
                )}
                {lost && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[9px] bg-tika motion-safe:animate-[single-blink_1.2s_ease-in-out_infinite]"
                  />
                )}
                <SymbolIcon symbol={symbol} size="60%" className="relative" />
                <span className="relative text-sm font-semibold text-wood sm:text-lg">
                  {t(`symbol.${symbol}`)}
                </span>
                <span className="relative text-xs text-wood/70 tabular-nums sm:text-sm">
                  {formatCoins(tile.total)} · {tile.bettors}👤
                </span>
                {k > 0 && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-wood px-1.5 text-xs font-bold text-marigold">
                    ×{k}
                  </span>
                )}
              </button>
              {mine > 0 && (
                <div className="absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-brass bg-marigold px-2 py-0.5 text-xs font-bold text-wood shadow">
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
    </Khal>
  )
}
