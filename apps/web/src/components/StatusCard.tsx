type Tone = 'ok' | 'pending' | 'error'

interface StatusCardProps {
  title: string
  tone: Tone
  lines: string[]
}

const toneClasses: Record<Tone, string> = {
  ok: 'border-jamara/60 bg-jamara/10',
  pending: 'border-marigold/60 bg-marigold/10',
  error: 'border-tika/60 bg-tika/10',
}

const dotClasses: Record<Tone, string> = {
  ok: 'bg-jamara',
  pending: 'bg-marigold animate-pulse',
  error: 'bg-tika',
}

export default function StatusCard({ title, tone, lines }: StatusCardProps) {
  return (
    <section className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <h2 className="flex items-center gap-2 font-semibold">
        <span className={`size-2.5 rounded-full ${dotClasses[tone]}`} aria-hidden />
        {title}
      </h2>
      <ul className="mt-2 space-y-1 text-sm text-cream/80">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
