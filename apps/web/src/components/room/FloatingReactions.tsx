import { useRoomStore } from '@/lib/roomStore'
import { useT, isMessageKey } from '@/lib/i18n'

// Emoji reactions bounce at the bottom; sound reactions show who played what.
export default function FloatingReactions() {
  const reactions = useRoomStore((s) => s.reactions)
  const sounds = useRoomStore((s) => s.soundReactions)
  const t = useT()
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 flex flex-col items-center gap-2"
      aria-hidden
    >
      {sounds.map((r) => {
        const key = `sound.${r.sound}`
        return (
          <span
            key={r.id}
            className="animate-bounce rounded-full bg-wood/90 px-3 py-1 text-sm font-semibold text-marigold shadow"
          >
            {r.displayName}: {isMessageKey(key) ? t(key) : r.sound}
          </span>
        )
      })}
      <div className="flex justify-center gap-2">
        {reactions.map((r) => (
          <span key={r.id} className="animate-bounce text-4xl">
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
