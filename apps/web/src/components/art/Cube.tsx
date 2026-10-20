import { SYMBOLS } from '@jhandi/game-rules/symbols'
import type { CSSProperties } from 'react'
import SymbolIcon from '@/components/art/SymbolIcon'

/**
 * A real 3D die (CSS `preserve-3d`): six wooden faces, one symbol each, brass inlay.
 * Face order is fixed, so showing symbol S means rotating the cube until face S is in front.
 */

// Faces are placed in SYMBOLS order; lib/dice.ts knows which rotation shows which symbol.
const FACE_TRANSFORMS = [
  'rotateY(0deg)', // front
  'rotateY(180deg)', // back
  'rotateY(90deg)', // right
  'rotateY(-90deg)', // left
  'rotateX(90deg)', // top
  'rotateX(-90deg)', // bottom
]
const WOOD =
  'repeating-linear-gradient(100deg, #8a5a32 0 3px, #7a4c28 3px 5px, #94643a 5px 9px), #86562e'

export default function Cube({ size = 52, style }: { size?: number; style?: CSSProperties }) {
  const half = size / 2
  return (
    <div
      className="relative"
      style={{ width: size, height: size, transformStyle: 'preserve-3d', ...style }}
    >
      {SYMBOLS.map((symbol, i) => (
        <div
          key={symbol}
          className="absolute inset-0 rounded-[16%] border border-black/25"
          style={{
            background: WOOD,
            transform: `${FACE_TRANSFORMS[i] ?? ''} translateZ(${half}px)`,
            backfaceVisibility: 'hidden',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.35)',
          }}
        >
          <div className="absolute inset-[14%] drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
            <SymbolIcon symbol={symbol} size="100%" variant="inlay" />
          </div>
        </div>
      ))}
    </div>
  )
}
