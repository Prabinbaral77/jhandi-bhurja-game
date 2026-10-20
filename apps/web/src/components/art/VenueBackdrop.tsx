import type { Venue } from '@jhandi/protocol/room'
import type { ReactElement } from 'react'

/**
 * Original stylised skylines of six heritage sites, drawn as flat silhouettes against an evening
 * sky (docs/art-direction.md §4). Temples are scenery only; no deity images anywhere.
 */

// One pagoda: `tiers` roofs stacked over a base at x (centre) with the given width.
const pagoda = (cx: number, baseY: number, width: number, tiers: number, key: string) => {
  const parts: ReactElement[] = []
  let w = width
  let y = baseY
  const tierH = Math.min(30, 130 / tiers)
  const roofH = tierH * 0.45
  // plinth
  parts.push(<rect key={`${key}-p`} x={cx - w / 2 - 10} y={y} width={w + 20} height={8} />)
  for (let i = 0; i < tiers; i++) {
    const roofTop = y - tierH
    // wall
    parts.push(
      <rect
        key={`${key}-w${i}`}
        x={cx - w / 2 + 8}
        y={roofTop + roofH}
        width={w - 16}
        height={tierH - roofH}
      />,
    )
    // solid sloping roof with upturned eaves, struts implied by the overhang
    const l = cx - w / 2 - 10
    const r = cx + w / 2 + 10
    const eave = roofTop + roofH + 2
    parts.push(
      <path
        key={`${key}-r${i}`}
        d={`M${l} ${eave} q4 -6 10 -8 L${cx} ${roofTop} L${r - 10} ${eave - 8} q6 2 10 8 L${r - 6} ${eave + 1} L${l + 6} ${eave + 1} z`}
      />,
    )
    w *= 0.74
    y = roofTop
  }
  // finial (gajur)
  parts.push(<path key={`${key}-g`} d={`M${cx} ${y - 20} l3 10 h-6 z`} />)
  parts.push(<rect key={`${key}-gs`} x={cx - 1} y={y - 12} width={2} height={14} />)
  return parts
}

// Shikhara-style stone spire (Krishna Mandir): stepped tiers narrowing into a tall tower.
const shikhara = (cx: number, baseY: number, key: string) => (
  <g key={key}>
    <rect x={cx - 56} y={baseY - 10} width={112} height={10} />
    <rect x={cx - 44} y={baseY - 36} width={88} height={26} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={cx - 34 + i * 7} y={baseY - 60 - i * 22} width={68 - i * 14} height={24} />
    ))}
    <path d={`M${cx - 14} ${baseY - 126} q14 -46 28 0z`} />
    <rect x={cx - 2} y={baseY - 150} width={4} height={26} />
    {[-40, 40].map((dx) => (
      <g key={dx}>
        <rect x={cx + dx - 10} y={baseY - 32} width={20} height={22} />
        <path d={`M${cx + dx - 12} ${baseY - 32} q12 -26 24 0z`} />
      </g>
    ))}
  </g>
)

// Stupa: dome, harmika (plain) and spire — no eyes, kept as pure architecture.
const stupa = (cx: number, baseY: number, key: string) => (
  <g key={key}>
    <rect x={cx - 70} y={baseY - 10} width={140} height={10} />
    <path d={`M${cx - 56} ${baseY - 10} a56 56 0 0 1 112 0z`} />
    <rect x={cx - 14} y={baseY - 80} width={28} height={16} />
    <path d={`M${cx - 16} ${baseY - 80} l16 -40 l16 40z`} />
    <rect x={cx - 1.5} y={baseY - 132} width={3} height={14} />
  </g>
)

const hills = (y: number, amp: number, key: string) => (
  <path key={key} d={`M0 ${y} q90 ${-amp} 180 0 t180 0 t180 0 t180 0 t180 0 v120 H0z`} />
)

const skyline: Record<Venue, (y: number) => ReactElement[]> = {
  NYATAPOLA: (y) => [
    hills(y + 6, 20, 'h'),
    ...pagoda(400, y, 180, 5, 'n'),
    ...pagoda(160, y, 90, 2, 'a'),
    ...pagoda(660, y, 110, 3, 'b'),
  ],
  KRISHNA_MANDIR: (y) => [
    hills(y + 6, 14, 'h'),
    shikhara(400, y, 'k'),
    ...pagoda(150, y, 100, 2, 'a'),
    ...pagoda(650, y, 120, 3, 'b'),
  ],
  BASANTAPUR: (y) => [
    hills(y + 6, 12, 'h'),
    ...pagoda(620, y, 120, 9, 'tower'),
    ...pagoda(300, y, 170, 3, 'a'),
    ...pagoda(120, y, 90, 2, 'b'),
    ...pagoda(460, y, 80, 2, 'c'),
  ],
  CHANGU_NARAYAN: (y) => [
    hills(y + 6, 40, 'h'),
    ...pagoda(400, y - 20, 200, 2, 'c'),
    ...pagoda(140, y, 70, 1, 'a'),
    ...pagoda(680, y, 70, 1, 'b'),
  ],
  SWAYAMBHU: (y) => [
    hills(y + 6, 50, 'h'),
    stupa(400, y - 30, 's'),
    ...pagoda(170, y, 80, 2, 'a'),
    ...pagoda(640, y, 80, 2, 'b'),
  ],
  GORKHA_DURBAR: (y) => [
    hills(y + 10, 70, 'h'),
    <rect key="wall" x={240} y={y - 30} width={320} height={30} />,
    ...pagoda(300, y - 30, 110, 2, 'a'),
    ...pagoda(500, y - 30, 130, 3, 'b'),
    ...pagoda(640, y - 10, 70, 1, 'c'),
  ],
}

const SKY: Record<Venue, [string, string]> = {
  NYATAPOLA: ['#2b1b3a', '#c2572a'],
  KRISHNA_MANDIR: ['#1c2541', '#d38b3a'],
  BASANTAPUR: ['#2a1a2e', '#b5452c'],
  CHANGU_NARAYAN: ['#152a3a', '#e0a046'],
  SWAYAMBHU: ['#1a2238', '#c97b3a'],
  GORKHA_DURBAR: ['#1b2a3a', '#d9a05b'],
}

export default function VenueBackdrop({
  venue,
  className = '',
}: {
  venue: Venue
  className?: string
}) {
  const [top, bottom] = SKY[venue]
  const horizon = 300
  return (
    <svg
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`sky-${venue}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill={`url(#sky-${venue})`} />
      {/* moon */}
      <circle cx="660" cy="80" r="26" fill="#f3e6c8" opacity="0.9" />
      <circle cx="672" cy="72" r="24" fill={top} opacity="0.9" />
      {/* kites */}
      <g className="kite" style={{ transformOrigin: '150px 120px' }}>
        <path d="M150 100l18 22-18 26-18-26z" fill="#d7262e" />
        <path d="M150 100l18 22-18 26z" fill="#f2a51a" />
        <path d="M150 148q6 30 -10 60" fill="none" stroke="#f3e6c8" strokeWidth="1" opacity="0.6" />
      </g>
      <g className="kite kite-2" style={{ transformOrigin: '560px 150px' }}>
        <path d="M560 130l14 18-14 20-14-20z" fill="#7baa3b" />
        <path d="M560 130l14 18-14 20z" fill="#f3e6c8" />
        <path d="M560 168q-6 26 8 52" fill="none" stroke="#f3e6c8" strokeWidth="1" opacity="0.6" />
      </g>
      <g fill="#140b08" opacity="0.92">
        {skyline[venue](horizon)}
      </g>
      <rect y={horizon} width="800" height="100" fill="#140b08" />
    </svg>
  )
}
