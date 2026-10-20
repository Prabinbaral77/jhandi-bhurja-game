import type { GameSymbol } from '@jhandi/game-rules/symbols'
import type { RoomPhase } from '@jhandi/protocol/room'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Cube from '@/components/art/Cube'
import { FACE_UP_ROTATION, landingsFor } from '@/lib/dice'
import { sfx } from '@/lib/sound'

/**
 * The throw, like at a real khal: the server's ROLLING phase lasts 3 s. For the first 1.4 s the
 * dice rattle inside a brass cup; then the cup tips and six 3D dice fly out, tumble, bounce
 * across the cloth and come to rest on their real faces as RESULT arrives.
 * Everything is CSS transforms (compositor only), so it holds 60 fps on cheap phones.
 */

const SHAKE_MS = 1_400
const THROW_MS = 1_500
const DIE = 52

type Stage = 'idle' | 'shaking' | 'thrown' | 'settled'

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
  const [stage, setStage] = useState<Stage>('idle')
  // Round whose throw this arena has already animated (RESULT after ROLLING keeps it going).
  const animatedRound = useRef<string | null>(null)
  // Pending stage changes. Kept in a ref so RESULT arriving mid-flight doesn't cut the throw short.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  useEffect(() => {
    if (phase === 'ROLLING' && animatedRound.current !== roundId) {
      animatedRound.current = roundId
      clearTimers()
      if (reduceMotion()) {
        later(() => {
          setStage('settled')
        }, 0)
      } else {
        later(() => {
          setStage('shaking')
        }, 0)
        later(() => {
          setStage('thrown')
        }, SHAKE_MS)
        later(() => {
          setStage('settled')
        }, SHAKE_MS + THROW_MS)
      }
    } else if (phase === 'RESULT') {
      if (animatedRound.current !== roundId) {
        // Joined mid-round: throw straight away, no shake.
        animatedRound.current = roundId
        clearTimers()
        later(() => {
          setStage(reduceMotion() ? 'settled' : 'thrown')
        }, 0)
        later(() => {
          setStage('settled')
        }, THROW_MS)
      }
    } else if (phase !== 'ROLLING') {
      clearTimers()
      later(() => {
        setStage('idle')
      }, 0)
    }
  }, [phase, roundId])

  useEffect(() => clearTimers, [])

  const previousStage = useRef<Stage>('idle')
  useEffect(() => {
    if (stage === 'thrown' && previousStage.current !== 'thrown') sfx('clatter')
    previousStage.current = stage
  }, [stage])

  // Arena size in px, so each die can start its flight from the cup regardless of screen width.
  const arenaRef = useRef<HTMLDivElement>(null)
  const [arena, setArena] = useState({ w: 400, h: 176 })
  useEffect(() => {
    const el = arenaRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setArena({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  const landings = useMemo(() => landingsFor(roundId || 'none'), [roundId])
  const showDice = (stage === 'thrown' || stage === 'settled') && dice.length === 6

  return (
    <div
      ref={arenaRef}
      className="relative mx-auto h-44 w-full max-w-md sm:h-52"
      style={{ perspective: '900px' }}
      aria-live="polite"
    >
      {/* cloth the dice land on */}
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_50%_40%,#6b2418,#3b1410_75%)] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]" />

      {/* brass cup: rattles while shaking, tips over to throw, lies on its side afterwards */}
      <div
        className={`absolute left-1/2 top-2 h-16 w-[72px] -translate-x-1/2 transition-transform duration-500 ${
          stage === 'shaking'
            ? 'motion-safe:animate-[cup-shake_0.18s_linear_infinite]'
            : stage === 'thrown' || stage === 'settled'
              ? 'origin-bottom [transform:translateX(-50%)_rotate(-115deg)_translateY(-6px)]'
              : ''
        } ${stage === 'settled' ? 'opacity-70' : ''}`}
      >
        <div
          className="h-full w-full rounded-b-[40%] rounded-t-[14%] border-2 border-[#8a6a1e] shadow-[0_8px_16px_rgba(0,0,0,0.5),inset_0_-10px_14px_rgba(0,0,0,0.45)]"
          style={{ background: 'linear-gradient(90deg,#8a6a1e,#e2c06a 40%,#c9a23a 60%,#7a5a14)' }}
        />
        <div className="absolute inset-x-1 top-0 h-3 rounded-[50%] bg-[#4a3510]" />
      </div>

      {showDice &&
        dice.map((face, i) => {
          const land = landings[i] ?? landings[0]
          if (!land) return null
          const rest = FACE_UP_ROTATION[face]
          // Flight starts at the cup mouth (top centre), expressed relative to the landing spot.
          const startX = arena.w * (0.5 - land.x / 100)
          const startY = -((arena.h * land.y) / 100) + 20
          const vars = {
            '--start-x': `${startX}px`,
            '--start-y': `${startY}px`,
            '--arc-x': `${land.arcX}px`,
            '--rx-end': `${rest.rx + land.spin * 360}deg`,
            '--ry-end': `${rest.ry + land.spin * 360}deg`,
            '--rz-end': `${land.tilt}deg`,
            animationDelay: `${land.delay}ms`,
            animationDuration: `${THROW_MS - land.delay}ms`,
          } as CSSProperties
          return (
            <div
              key={`${roundId}-${i}`}
              className={`absolute ${stage === 'thrown' ? 'motion-safe:animate-[die-throw_cubic-bezier(0.2,0.7,0.3,1)_both]' : ''}`}
              style={{
                ...vars,
                left: `calc(${land.x}% - ${DIE / 2}px)`,
                top: `calc(${land.y}% - ${DIE / 2}px)`,
                transformStyle: 'preserve-3d',
                transform:
                  stage === 'settled'
                    ? `rotateX(${rest.rx}deg) rotateY(${rest.ry}deg) rotateZ(${land.tilt}deg)`
                    : undefined,
              }}
            >
              {/* ground shadow */}
              <div className="absolute left-1/2 top-[88%] h-4 w-14 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />
              <Cube size={DIE} />
            </div>
          )
        })}
    </div>
  )
}
