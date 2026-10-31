import type { GameSymbol } from '@jhandi/game-rules/symbols'
import type { ReactElement, SVGProps } from 'react'

/**
 * The six Jhandi Burja symbols drawn after the hand-carved dice sold in Nepal: red and black
 * figures cut into yellow plastic, with concentric-ring "eyes", rows of dots, hatching and
 * beaded arcs. The pale strokes are the grooves showing the die colour underneath.
 *
 * `variant="color"` is the full folk figure (dice, board). `variant="inlay"` is a one-colour
 * silhouette for tiny UI (lobby lists, ticker). No deity imagery (docs/art-direction.md §5).
 */

interface SymbolIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  symbol: GameSymbol
  size?: number | string
  variant?: 'color' | 'inlay'
}

const RED = '#c8201d'
const BLACK = '#1f1a14'
const GROOVE = '#e9c24a' // die colour showing through the carving
const BRASS = '#C9A23A'

// Concentric "eye": outer ring, inner ring, dot — the signature of these dice.
const eye = (cx: number, cy: number, r: number, ink: string, key: string) => (
  <g key={key}>
    <circle cx={cx} cy={cy} r={r} fill={ink} />
    <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke={GROOVE} strokeWidth={r * 0.16} />
    <circle cx={cx} cy={cy} r={r * 0.3} fill="none" stroke={GROOVE} strokeWidth={r * 0.16} />
  </g>
)

// Rows of short dashes (the stippled fill).
const dots = (x0: number, y0: number, cols: number, rows: number, step: number, key: string) => {
  const items: ReactElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push(
        <rect
          key={`${key}-${r}-${c}`}
          x={x0 + c * step + (r % 2) * (step / 2)}
          y={y0 + r * step}
          width={step * 0.45}
          height={step * 0.45}
          rx={step * 0.1}
          fill={GROOVE}
        />,
      )
    }
  }
  return items
}

const hatch = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  n: number,
  key: string,
  vertical = true,
) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1)
    return vertical ? (
      <line
        key={`${key}-${i}`}
        x1={x0 + (x1 - x0) * t}
        y1={y0}
        x2={x0 + (x1 - x0) * t}
        y2={y1}
        stroke={GROOVE}
        strokeWidth="2.2"
      />
    ) : (
      <line
        key={`${key}-${i}`}
        x1={x0}
        y1={y0 + (y1 - y0) * t}
        x2={x1}
        y2={y0 + (y1 - y0) * t}
        stroke={GROOVE}
        strokeWidth="2.2"
      />
    )
  })

const HEART_PATH = 'M50 90C30 74 12 60 12 40a19 19 0 0 1 38-6 19 19 0 0 1 38 6c0 20-18 34-38 50z'
const SPADE_PATH =
  'M50 8C36 26 14 40 14 58a17 17 0 0 0 31 10c-1 10-7 17-14 22h38c-7-5-13-12-14-22a17 17 0 0 0 31-10c0-18-22-32-36-50z'

const folk: Record<GameSymbol, () => ReactElement> = {
  HEART: () => (
    <>
      <path d={HEART_PATH} fill={RED} />
      <g clipPath="url(#heart-clip)">{dots(28, 52, 6, 3, 8, 'hd')}</g>
      {eye(31, 38, 14, RED, 'he1')}
      {eye(69, 38, 14, RED, 'he2')}
      <defs>
        <clipPath id="heart-clip">
          <path d={HEART_PATH} transform="translate(50 50) scale(0.8) translate(-50 -50)" />
        </clipPath>
      </defs>
    </>
  ),
  SPADE: () => (
    <>
      <path d={SPADE_PATH} fill={BLACK} />
      <g clipPath="url(#spade-clip)">{dots(32, 24, 6, 3, 7, 'sd')}</g>
      {eye(33, 58, 13, BLACK, 'se1')}
      {eye(67, 58, 13, BLACK, 'se2')}
      <path d="M50 70v18" stroke={GROOVE} strokeWidth="2" />
      <defs>
        <clipPath id="spade-clip">
          <path d={SPADE_PATH} transform="translate(50 50) scale(0.82) translate(-50 -50)" />
        </clipPath>
      </defs>
    </>
  ),
  CLUB: () => (
    <>
      {eye(50, 28, 17, BLACK, 'ce1')}
      {eye(28, 60, 17, BLACK, 'ce2')}
      {eye(72, 60, 17, BLACK, 'ce3')}
      <path d="M44 66h12l6 24H38z" fill={BLACK} />
      <path d="M50 70v16" stroke={GROOVE} strokeWidth="2" />
    </>
  ),
  DIAMOND: () => (
    <>
      <path d="M50 6L88 50 50 94 12 50z" fill={RED} />
      <path d="M50 16L78 50 50 84 22 50z" fill="none" stroke={GROOVE} strokeWidth="2.2" />
      <g clipPath="url(#diamond-clip)">{hatch(24, 20, 76, 80, 7, 'dh', false)}</g>
      <g clipPath="url(#diamond-clip)">{hatch(26, 20, 74, 80, 5, 'dv')}</g>
      <ellipse cx="50" cy="50" rx="13" ry="10" fill={RED} stroke={GROOVE} strokeWidth="2.4" />
      <circle cx="50" cy="50" r="4" fill={GROOVE} />
      <defs>
        <clipPath id="diamond-clip">
          <path d="M50 20L74 50 50 80 26 50z" />
        </clipPath>
      </defs>
    </>
  ),
  FLAG: () => (
    <>
      {/* butterfly-like double pennant: two red triangles meeting at the pole */}
      <path
        d="M50 50L14 14l8 36-8 36z"
        fill={RED}
        stroke={BLACK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M50 50l36-36-8 36 8 36z"
        fill={RED}
        stroke={BLACK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {hatch(18, 30, 42, 70, 4, 'fh1')}
      {hatch(58, 30, 82, 70, 4, 'fh2')}
      {/* crossed black staves */}
      <path d="M22 12L78 88M78 12L22 88" stroke={BLACK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M50 10v80" stroke={BLACK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5" fill={GROOVE} stroke={BLACK} strokeWidth="2" />
    </>
  ),
  CROWN: () => (
    <>
      {/* beaded black arc around the dome */}
      {Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i / 12) * Math.PI
        return (
          <circle
            key={`b${i}`}
            cx={50 + Math.cos(a) * 40}
            cy={58 + Math.sin(a) * 40}
            r="4.2"
            fill={BLACK}
          />
        )
      })}
      {/* dome */}
      <path d="M20 60a30 30 0 0 1 60 0z" fill={RED} />
      <path d="M20 60a30 30 0 0 1 60 0" fill="none" stroke={BLACK} strokeWidth="4" />
      {hatch(26, 36, 74, 58, 6, 'ch')}
      <circle cx="50" cy="28" r="4.5" fill={GROOVE} stroke={BLACK} strokeWidth="2" />
      {/* black rim with beads */}
      <rect x="16" y="60" width="68" height="7" rx="3" fill={BLACK} />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={`r${i}`} cx={24 + i * 8.7} cy={63.5} r="1.6" fill={GROOVE} />
      ))}
      {/* red hatched base band */}
      <path d="M14 74h72l-6 14H20z" fill={RED} />
      {hatch(20, 75, 80, 87, 9, 'cb')}
    </>
  ),
}

const silhouette: Record<GameSymbol, (ink: string) => ReactElement> = {
  HEART: (ink) => <path d={HEART_PATH} fill={ink} />,
  SPADE: (ink) => <path d={SPADE_PATH} fill={ink} />,
  CLUB: (ink) => (
    <>
      <circle cx="50" cy="28" r="17" fill={ink} />
      <circle cx="28" cy="60" r="17" fill={ink} />
      <circle cx="72" cy="60" r="17" fill={ink} />
      <path d="M44 66h12l6 24H38z" fill={ink} />
    </>
  ),
  DIAMOND: (ink) => <path d="M50 6L88 50 50 94 12 50z" fill={ink} />,
  FLAG: (ink) => (
    <path d="M50 50L14 14l8 36-8 36zM50 50l36-36-8 36 8 36zM47 8h6v84h-6z" fill={ink} />
  ),
  CROWN: (ink) => (
    <>
      <path d="M20 60a30 30 0 0 1 60 0z" fill={ink} />
      <rect x="16" y="60" width="68" height="7" rx="3" fill={ink} />
      <path d="M14 74h72l-6 14H20z" fill={ink} />
    </>
  ),
}

export default function SymbolIcon({
  symbol,
  size = 48,
  variant = 'color',
  ...rest
}: SymbolIconProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false" {...rest}>
      {variant === 'color' ? folk[symbol]() : silhouette[symbol](BRASS)}
    </svg>
  )
}
