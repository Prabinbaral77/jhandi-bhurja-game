import type { GameSymbol } from '@jhandi/game-rules/symbols'
import type { RoomPhase } from '@jhandi/protocol/room'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import SymbolIcon from '@/components/art/SymbolIcon'
import Button from '@/components/Button'
import { useLanguageStore, useT } from '@/lib/i18n'

/**
 * Full-screen throw: the server's ROLLING phase lasts 3 s. The brass cup rattles for 1.4 s,
 * then the six dice fly out in real 3D (DiceScene, three.js), bounce across the whole floor and
 * come to rest on the faces the server rolled. They stay on screen for HOLD_MS so everyone can
 * read the throw, then a 3-2-1 countdown, and only then the overlay goes and the board underneath
 * shows the winning tiles for the rest of RESULT. Joining mid-round shows the dice at rest.
 */

const DiceScene = lazy(() => import('@/components/room/DiceScene'))

const SHAKE_MS = 1_400
const ROLL_MS = 2_600
// How long the resting dice stay on screen before the 3-2-1 countdown: time to read the throw.
const HOLD_MS = 6_000
const COUNTDOWN_S = 3
const DEVANAGARI_DIGITS = '०१२३४५६७८९'

type Stage = 'idle' | 'shaking' | 'thrown' | 'settled' | 'countdown' | 'done'

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function DiceArena({
  dice,
  phase,
  roundId,
}: {
  dice: GameSymbol[]
  phase: RoomPhase
  roundId: string
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [stage, setStage] = useState<Stage>('idle')
  const [count, setCount] = useState(COUNTDOWN_S)
  // Round whose throw this arena has already animated (RESULT after ROLLING keeps it going).
  const animatedRound = useRef<string | null>(null)
  // The dice of the throw being shown. Kept here so the whole sequence (rest → 3-2-1 → board)
  // finishes even if the server has already moved on to the next round and cleared `dice`.
  const [shown, setShown] = useState<{ roundId: string; dice: GameSymbol[] }>({
    roundId: '',
    dice: [],
  })
  // Pending stage changes. Kept in a ref so RESULT arriving mid-flight doesn't cut the throw short.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => {
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
    // 3 … 2 … 1, one second each, starting `at` ms from now; then the board takes over.
    const scheduleCountdown = (at: number) => {
      for (let n = COUNTDOWN_S; n >= 1; n--) {
        later(
          () => {
            setCount(n)
            setStage('countdown')
          },
          at + (COUNTDOWN_S - n) * 1000,
        )
      }
      later(
        () => {
          setStage('done')
          timers.current = []
        },
        at + COUNTDOWN_S * 1000,
      )
    }

    if (phase === 'ROLLING' && animatedRound.current !== roundId) {
      animatedRound.current = roundId
      clearTimers()
      const shake = reduceMotion() ? 0 : SHAKE_MS
      const roll = reduceMotion() ? 0 : ROLL_MS
      later(() => {
        setShown({ roundId, dice })
        setStage(shake ? 'shaking' : 'thrown')
      }, 0)
      later(() => {
        setStage('thrown')
      }, shake)
      later(() => {
        setStage('settled')
      }, shake + roll)
      scheduleCountdown(shake + roll + HOLD_MS)
    } else if (phase === 'RESULT') {
      if (animatedRound.current !== roundId) {
        // Joined mid-round: show the dice at rest for the hold, no throw.
        animatedRound.current = roundId
        clearTimers()
        later(() => {
          setShown({ roundId, dice })
          setStage('settled')
        }, 0)
        scheduleCountdown(HOLD_MS)
      }
    } else if (phase !== 'ROLLING' && timers.current.length === 0) {
      // Nothing in progress (a running sequence ends on its own 'done'): make sure we're hidden.
      later(() => {
        setStage('idle')
      }, 0)
    }
  }, [phase, roundId, dice])

  useEffect(() => clearTimers, [])

  const throwDice = shown.dice
  const throwRound = shown.roundId
  if (stage === 'idle' || stage === 'done' || throwDice.length !== 6) return null

  const counts = throwDice.reduce<Partial<Record<GameSymbol, number>>>((acc, d) => {
    acc[d] = (acc[d] ?? 0) + 1
    return acc
  }, {})
  const winners = (Object.entries(counts) as [GameSymbol, number][]).filter(([, k]) => k >= 2)
  const atRest = stage === 'settled' || stage === 'countdown'

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
      <div className="absolute inset-0 bg-[#2a0f0a]/85" />
      <Suspense fallback={null}>
        <DiceScene stage={atRest ? 'settled' : stage} dice={throwDice} roundId={throwRound} />
      </Suspense>

      {stage === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span
            key={count}
            className="text-[9rem] leading-none font-bold text-marigold drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)] motion-safe:animate-[settle_0.5s_ease-out_both]"
          >
            {language === 'ne' ? DEVANAGARI_DIGITS[count] : count}
          </span>
          <span className="rounded-full bg-black/65 px-4 py-1.5 text-lg text-cream">
            {t('toBoard')}
          </span>
        </div>
      )}

      {/* read-out at the bottom once the dice are at rest */}
      {atRest && (
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4 motion-safe:animate-[settle_0.4s_ease-out_both]">
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-full bg-black/65 px-5 py-2">
            {winners.length === 0 ? (
              <span className="text-sm text-cream/80">{t('noPairs')}</span>
            ) : (
              winners.map(([symbol, k]) => (
                <span
                  key={symbol}
                  className="flex items-center gap-1.5 text-xl font-bold text-marigold"
                >
                  <SymbolIcon symbol={symbol} size={30} />
                  {t(`symbol.${symbol}`)} ×{k}
                </span>
              ))
            )}
          </div>
          {/* Seen enough? Skip the rest of the wait and the countdown. */}
          <Button
            variant="secondary"
            className="pointer-events-auto min-h-10 bg-black/60 text-sm"
            onClick={() => {
              clearTimers()
              setStage('done')
            }}
          >
            {t('goToBoard')} →
          </Button>
        </div>
      )}
    </div>
  )
}
