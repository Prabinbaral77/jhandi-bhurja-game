import { useRoomStore } from '@/lib/roomStore'

export default function FloatingReactions() {
  const reactions = useRoomStore((s) => s.reactions)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 flex justify-center gap-2"
      aria-hidden
    >
      {reactions.map((r) => (
        <span key={r.id} className="animate-bounce text-4xl">
          {r.emoji}
        </span>
      ))}
    </div>
  )
}
