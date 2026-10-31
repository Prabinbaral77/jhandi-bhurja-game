import type { ReactNode } from 'react'

/**
 * The khal the bets go on: a mat of split bamboo strips woven over and under (like a Nepali
 * bamboo mandro), with brass corner pieces. Pure SVG pattern, so it costs no image download.
 */
export default function Khal({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)] sm:p-4">
      <svg className="absolute inset-0 size-full rounded-2xl" aria-hidden focusable="false">
        <defs>
          {/* one bamboo strip: pale centre, darker edges, a node every so often */}
          <linearGradient id="bamboo-h" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8803c" />
            <stop offset="0.18" stopColor="#d9b15a" />
            <stop offset="0.5" stopColor="#e6c46f" />
            <stop offset="0.82" stopColor="#cfa64f" />
            <stop offset="1" stopColor="#8e6a2c" />
          </linearGradient>
          <linearGradient id="bamboo-v" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9b7434" />
            <stop offset="0.18" stopColor="#cfa64f" />
            <stop offset="0.5" stopColor="#dcb962" />
            <stop offset="0.82" stopColor="#c59a45" />
            <stop offset="1" stopColor="#80602a" />
          </linearGradient>
          {/* plain weave: in each 48×48 cell the horizontal strip is on top in two quarters and
              the vertical strip in the other two */}
          <pattern id="bamboo-weave" width="48" height="48" patternUnits="userSpaceOnUse">
            <rect width="48" height="48" fill="#5a3f16" />
            <rect x="0" y="2" width="48" height="20" fill="url(#bamboo-h)" />
            <rect x="0" y="26" width="48" height="20" fill="url(#bamboo-h)" />
            <rect x="2" y="0" width="20" height="48" fill="url(#bamboo-v)" />
            <rect x="26" y="0" width="20" height="48" fill="url(#bamboo-v)" />
            {/* horizontal strips back on top in alternating squares */}
            <rect x="24" y="2" width="24" height="20" fill="url(#bamboo-h)" />
            <rect x="0" y="26" width="24" height="20" fill="url(#bamboo-h)" />
            {/* node lines on the strips */}
            <path d="M12 2v20M36 26v20" stroke="#8a6628" strokeWidth="1.2" opacity="0.7" />
            <path d="M2 36h20M26 12h20" stroke="#8a6628" strokeWidth="1.2" opacity="0.7" />
            {/* shadow where a strip goes under */}
            <path d="M24 2v20M0 26v20" stroke="#000" strokeWidth="2" opacity="0.25" />
            <path d="M2 24h20M26 0h20" stroke="#000" strokeWidth="2" opacity="0.25" />
          </pattern>
          <linearGradient id="khal-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bamboo-weave)" />
        <rect width="100%" height="100%" fill="url(#khal-shade)" />
        <rect
          x="4"
          y="4"
          width="calc(100% - 8px)"
          height="calc(100% - 8px)"
          fill="none"
          stroke="#5a3f16"
          strokeWidth="6"
          rx="12"
        />
        <rect
          x="7"
          y="7"
          width="calc(100% - 14px)"
          height="calc(100% - 14px)"
          fill="none"
          stroke="#c9a23a"
          strokeWidth="1.5"
          rx="10"
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
