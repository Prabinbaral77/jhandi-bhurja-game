import type { ReactNode } from 'react'

/**
 * The khal: a Dhaka-patterned cloth with brass corner pieces, on which the six tiles lie
 * (docs/art-direction.md §4). Pure SVG pattern, so it costs no image download.
 */
export default function Khal({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)] sm:p-4">
      <svg className="absolute inset-0 size-full rounded-2xl" aria-hidden focusable="false">
        <defs>
          <pattern id="dhaka" width="28" height="28" patternUnits="userSpaceOnUse">
            <rect width="28" height="28" fill="#7a2a1c" />
            <path
              d="M0 14l7-7 7 7 7-7 7 7M0 28l7-7 7 7 7-7 7 7"
              fill="none"
              stroke="#f2a51a"
              strokeWidth="1.6"
            />
            <path
              d="M0 7l7 7 7-7 7 7 7-7M0 21l7 7 7-7 7 7 7-7"
              fill="none"
              stroke="#f3e6c8"
              strokeWidth="0.9"
              opacity="0.6"
            />
            <rect x="12" y="12" width="4" height="4" fill="#1f3f8f" transform="rotate(45 14 14)" />
          </pattern>
          <linearGradient id="khal-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dhaka)" />
        <rect width="100%" height="100%" fill="url(#khal-shade)" />
        <rect
          x="4"
          y="4"
          width="calc(100% - 8px)"
          height="calc(100% - 8px)"
          fill="none"
          stroke="#c9a23a"
          strokeWidth="2"
          rx="12"
        />
      </svg>
      {/* brass corners */}
      {[
        'top-1 left-1',
        'top-1 right-1 rotate-90',
        'bottom-1 right-1 rotate-180',
        'bottom-1 left-1 -rotate-90',
      ].map((pos) => (
        <svg
          key={pos}
          className={`absolute size-7 ${pos}`}
          viewBox="0 0 28 28"
          aria-hidden
          focusable="false"
        >
          <path
            d="M2 26V8q0-6 6-6h18"
            fill="none"
            stroke="#c9a23a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="7" cy="7" r="3" fill="#8a6a1e" />
        </svg>
      ))}
      <div className="relative">{children}</div>
    </div>
  )
}
