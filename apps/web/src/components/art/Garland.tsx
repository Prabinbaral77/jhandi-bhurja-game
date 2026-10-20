// Marigold (sayapatri) garland under the header — a Dashain touch (docs/art-direction.md §4).
export default function Garland() {
  const flowers = Array.from({ length: 24 }, (_, i) => i)
  return (
    <svg
      viewBox="0 0 960 36"
      preserveAspectRatio="none"
      className="h-5 w-full text-marigold"
      aria-hidden
      focusable="false"
    >
      <path d="M0 6q480 50 960 0" fill="none" stroke="#7baa3b" strokeWidth="3" />
      {flowers.map((i) => {
        const x = 20 + i * 40
        // Follow the curve of the string.
        const t = x / 960
        const y = 6 + 24 * Math.sin(Math.PI * t)
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="7" fill={i % 3 === 0 ? '#d7262e' : '#f2a51a'} />
            <circle r="3" fill={i % 3 === 0 ? '#f2a51a' : '#c2572a'} />
          </g>
        )
      })}
    </svg>
  )
}
