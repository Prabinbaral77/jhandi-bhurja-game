import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { useEffect, useState } from 'react'
import { SYMBOL_COLOR, SYMBOL_GLYPH } from '@/components/room/symbolStyle'

const SHUFFLE_MS = 120

const randomFaces = (): GameSymbol[] =>
  Array.from({ length: 6 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] ?? 'CROWN')

// Placeholder "shake": faces flicker while ROLLING, then settle on the real dice (M6 animates).
export default function DiceRow({ dice, rolling }: { dice: GameSymbol[]; rolling: boolean }) {
  const [shuffled, setShuffled] = useState<GameSymbol[]>(randomFaces)

  useEffect(() => {
    if (!rolling) return
    const timer = setInterval(() => {
      setShuffled(randomFaces())
    }, SHUFFLE_MS)
    return () => {
      clearInterval(timer)
    }
  }, [rolling])

  const faces = rolling ? shuffled : dice
  if (faces.length === 0) return null

  return (
    <div className="flex justify-center gap-2" aria-live="polite">
      {faces.map((face, i) => (
        <span
          key={i}
          className={`grid size-12 place-items-center rounded-lg border-2 border-brass bg-cream text-2xl shadow-md sm:size-14 ${
            rolling ? 'animate-bounce' : ''
          } ${SYMBOL_COLOR[face] === 'text-cream' ? 'text-wood' : SYMBOL_COLOR[face]}`}
          style={rolling ? { animationDelay: `${i * 60}ms` } : undefined}
        >
          {SYMBOL_GLYPH[face]}
        </span>
      ))}
    </div>
  )
}
