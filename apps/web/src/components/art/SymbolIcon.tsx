import type { GameSymbol } from '@jhandi/game-rules/symbols'
import type { ReactElement, SVGProps } from 'react'

/**
 * Original vector art for the six Jhandi Burja symbols (docs/art-direction.md §4).
 * Traditional silhouettes kept recognisable at 24 px; Nepali details inside:
 * crown = shirpech with plume, flag = Nepal's double pennant, heart/spade/diamond/club with
 * carved-wood lines, pagoda eaves, Dhaka zigzag and lotus petals. No deity imagery.
 */

interface SymbolIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  symbol: GameSymbol
  size?: number | string
  // 'color' = full colour (board, dice reveal); 'inlay' = single brass colour (dice, small UI).
  variant?: 'color' | 'inlay'
}

const BRASS = '#C9A23A'
const BRASS_DARK = '#8A6A1E'
const TIKA = '#D7262E'
const CRIMSON = '#C8102E'
const BLUE = '#1F3F8F'
const CREAM = '#F3E6C8'
const WOOD = '#3B2418'

const art: Record<GameSymbol, (inlay: boolean) => ReactElement> = {
  CROWN: (inlay) => (
    <>
      {/* plume */}
      <path
        d="M50 8c-6 8-12 14-9 26 2-8 6-13 9-16 3 3 7 8 9 16 3-12-3-18-9-26z"
        fill={inlay ? BRASS : BRASS}
      />
      {/* dome */}
      <path d="M22 60c0-18 12-30 28-30s28 12 28 30z" fill={inlay ? BRASS : TIKA} />
      <path d="M50 30v30" stroke={inlay ? BRASS_DARK : BRASS} strokeWidth="3" />
      <path
        d="M30 52c6-10 14-14 20-14s14 4 20 14"
        fill="none"
        stroke={inlay ? BRASS_DARK : BRASS}
        strokeWidth="3"
      />
      {/* band */}
      <rect x="18" y="58" width="64" height="16" rx="4" fill={inlay ? BRASS : BRASS} />
      <rect
        x="18"
        y="58"
        width="64"
        height="16"
        rx="4"
        fill="none"
        stroke={BRASS_DARK}
        strokeWidth="2"
      />
      {/* jewels */}
      <circle cx="32" cy="66" r="3.5" fill={inlay ? BRASS_DARK : TIKA} />
      <circle cx="50" cy="66" r="4" fill={inlay ? BRASS_DARK : '#2E7D32'} />
      <circle cx="68" cy="66" r="3.5" fill={inlay ? BRASS_DARK : TIKA} />
      {/* base */}
      <rect x="22" y="76" width="56" height="8" rx="3" fill={inlay ? BRASS : WOOD} />
    </>
  ),
  FLAG: (inlay) => (
    <>
      {/* pole */}
      <rect x="14" y="8" width="5" height="84" rx="2" fill={inlay ? BRASS : WOOD} />
      {/* double pennant: blue border then crimson */}
      <path d="M19 10l56 26H44l32 30H19z" fill={inlay ? BRASS : BLUE} />
      <path d="M23 16l42 20H40l28 26H23z" fill={inlay ? BRASS_DARK : CRIMSON} />
      {/* moon */}
      <path d="M34 32a6 6 0 1 0 12 0 8 8 0 0 1-12 0z" fill={inlay ? BRASS : CREAM} />
      {/* sun */}
      <circle cx="40" cy="54" r="5" fill={inlay ? BRASS : CREAM} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4
        return (
          <line
            key={i}
            x1={40 + Math.cos(a) * 6.5}
            y1={54 + Math.sin(a) * 6.5}
            x2={40 + Math.cos(a) * 9}
            y2={54 + Math.sin(a) * 9}
            stroke={inlay ? BRASS : CREAM}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
    </>
  ),
  HEART: (inlay) => (
    <>
      <path
        d="M50 86C30 70 14 56 14 38a18 18 0 0 1 36-6 18 18 0 0 1 36 6c0 18-16 32-36 48z"
        fill={inlay ? BRASS : TIKA}
      />
      {/* carved inner line */}
      <path
        d="M50 74C36 62 24 52 24 39a9 9 0 0 1 18-2l8 8 8-8a9 9 0 0 1 18 2c0 13-12 23-26 35z"
        fill="none"
        stroke={inlay ? BRASS_DARK : BRASS}
        strokeWidth="2.5"
      />
    </>
  ),
  SPADE: (inlay) => (
    <>
      <path
        d="M50 10C36 28 16 40 16 56a16 16 0 0 0 30 8c-2 10-8 16-14 20h36c-6-4-12-10-14-20a16 16 0 0 0 30-8c0-16-20-28-34-46z"
        fill={inlay ? BRASS : WOOD}
      />
      {/* pagoda eaves */}
      <path
        d="M28 46q22-10 44 0"
        fill="none"
        stroke={inlay ? BRASS_DARK : BRASS}
        strokeWidth="2.5"
      />
      <path
        d="M34 34q16-8 32 0"
        fill="none"
        stroke={inlay ? BRASS_DARK : BRASS}
        strokeWidth="2.5"
      />
      <circle cx="50" cy="22" r="2.5" fill={inlay ? BRASS_DARK : BRASS} />
    </>
  ),
  DIAMOND: (inlay) => (
    <>
      <path d="M50 8L84 50 50 92 16 50z" fill={inlay ? BRASS : TIKA} />
      {/* Dhaka zigzag */}
      <path
        d="M30 50l6-7 6 7 8-7 8 7 6-7 6 7"
        fill="none"
        stroke={inlay ? BRASS_DARK : BRASS}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M36 38l7-6 7 6 7-6 7 6M36 62l7 6 7-6 7 6 7-6"
        fill="none"
        stroke={inlay ? BRASS_DARK : CREAM}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </>
  ),
  CLUB: (inlay) => (
    <>
      <circle cx="50" cy="30" r="17" fill={inlay ? BRASS : WOOD} />
      <circle cx="30" cy="56" r="17" fill={inlay ? BRASS : WOOD} />
      <circle cx="70" cy="56" r="17" fill={inlay ? BRASS : WOOD} />
      <path d="M44 60h12l6 28H38z" fill={inlay ? BRASS : WOOD} />
      {/* lotus petals */}
      <path
        d="M50 20q6 8 0 18q-6-10 0-18zM30 46q6 8 0 18q-6-10 0-18zM70 46q6 8 0 18q-6-10 0-18z"
        fill={inlay ? BRASS_DARK : BRASS}
      />
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
      {art[symbol](variant === 'inlay')}
    </svg>
  )
}
