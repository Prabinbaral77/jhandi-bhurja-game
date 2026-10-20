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
}

// Carved wooden frame (tunal-style) around each symbol tile.
const tileBase =
  'relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-[3px] p-2 transition-transform ' +
  'bg-[linear-gradient(135deg,#f3e6c8,#e4d0a4)] shadow-[inset_0_0_0_3px_#8a5a32,inset_0_0_0_5px_#c9a23a,0_4px_10px_rgba(0,0,0,0.45)]'

export default function Board({ snapshot, myBets, canBet, onBet, onCancel }: BoardProps) {
  const t = useT()
  const showing = snapshot.phase === 'RESULT' || snapshot.phase === 'ROLLING'
  const matches = (symbol: GameSymbol) => snapshot.lastDice.filter((d) => d === symbol).length

  return (
    <Khal>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {SYMBOLS.map((symbol) => {
          const tile = snapshot.board[symbol] ?? { total: 0, bettors: 0 }
          const mine = myBets[symbol] ?? 0
          const k = showing ? matches(symbol) : 0
          const won = snapshot.phase === 'RESULT' && k >= 2
          const frame = won
            ? 'border-marigold scale-[1.04] motion-safe:animate-[glow_1.2s_ease-in-out_infinite]'
            : 'border-[#5c3a1e]'
          return (
            <div key={symbol} className="relative">
              <button
                type="button"
                disabled={!canBet}
                onClick={() => {
                  onBet(symbol)
                }}
                className={`${tileBase} ${frame} enabled:hover:border-marigold enabled:active:scale-95 disabled:cursor-default`}
              >
                <SymbolIcon symbol={symbol} size="56%" />
                <span className="text-sm font-semibold text-wood">{t(`symbol.${symbol}`)}</span>
                <span className="text-xs text-wood/70 tabular-nums">
                  {formatCoins(tile.total)} · {tile.bettors}👤
                </span>
                {snapshot.phase === 'RESULT' && k > 0 && (
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
