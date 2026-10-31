import { REACTIONS, SOUND_REACTIONS, type RoomSnapshot } from '@jhandi/protocol/room'
import { useState } from 'react'
import Button from '@/components/Button'
import type { RoomActions } from '@/hooks/useJhandiRoom'
import { useT } from '@/lib/i18n'
import { useRoomStore } from '@/lib/roomStore'
import { formatCoins } from '@/utils/format'

export default function SidePanel({
  snapshot,
  actions,
  canRemove,
}: {
  snapshot: RoomSnapshot
  actions: RoomActions
  canRemove: boolean
}) {
  const t = useT()
  const feed = useRoomStore((s) => s.feed)
  const chat = useRoomStore((s) => s.chat)
  const [text, setText] = useState('')
  const members = Object.values(snapshot.members).sort((a, b) => a.role.localeCompare(b.role))

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section>
        <h2 className="mb-2 font-semibold">
          {t('members')} ({members.length})
        </h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {members.map((m) => (
            <li
              key={m.userId}
              className={`rounded-full px-3 py-1 ${m.role === 'HOST' ? 'bg-marigold/20 text-marigold' : m.role === 'PLAYER' ? 'bg-jamara/15' : 'bg-cream/10 text-cream/60'} ${m.connected ? '' : 'opacity-50'}`}
            >
              {m.displayName}
              {canRemove && m.role !== 'HOST' && (
                <button
                  type="button"
                  aria-label={t('removeMember')}
                  title={t('removeMember')}
                  className="ml-1 rounded-full px-1 text-tika hover:bg-tika/20"
                  onClick={() => {
                    actions.removeMember(m.userId)
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t('feed')}</h2>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-cream/80">
          {feed.map((f, i) => (
            <li key={`${f.at}-${i}`}>
              {t(`feed.${f.type}`, {
                name: f.displayName,
                n: formatCoins(f.amount),
                symbol: f.symbol ? t(`symbol.${f.symbol}`) : '',
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {chat.map((line) => (
            <li key={`${line.at}-${line.userId}`}>
              <span className="font-semibold text-marigold">{line.displayName}:</span> {line.text}
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-lg px-2 py-1 text-xl hover:bg-cream/10"
              onClick={() => {
                actions.react(emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <SoundBar onPlay={actions.playSound} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            actions.chat(text.trim())
            setText('')
          }}
        >
          <input
            value={text}
            maxLength={200}
            placeholder={t('chatPlaceholder')}
            onChange={(e) => {
              setText(e.target.value)
            }}
            className="min-w-0 flex-1 rounded-lg border border-cream/20 bg-wood px-3 py-2"
          />
          <Button type="submit" variant="secondary">
            {t('send')}
          </Button>
        </form>
      </section>
    </div>
  )
}

const SOUND_ICONS: Record<(typeof SOUND_REACTIONS)[number], string> = {
  wow: '🤩',
  ooh: '😬',
  laugh: '🤣',
  cry: '😭',
  quack: '🦆',
  fart: '💨',
  applause: '👏',
  boo: '👎',
  dhol: '🥁',
  whistle: '😗',
  kiss: '😘',
  coins: '🪙',
}
// Server allows one sound per player every 3 s; mirror that so the button shows why.
const SOUND_COOLDOWN_MS = 3_000

function SoundBar({ onPlay }: { onPlay: (sound: (typeof SOUND_REACTIONS)[number]) => void }) {
  const t = useT()
  const [coolingDown, setCoolingDown] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-cream/50">
        {t('soundsTitle')}
        {coolingDown && <span className="ml-2 text-marigold">{t('soundCooldown')}</span>}
      </p>
      <div className="grid grid-cols-6 gap-1">
        {SOUND_REACTIONS.map((sound) => (
          <button
            key={sound}
            type="button"
            title={t(`sound.${sound}`)}
            aria-label={t(`sound.${sound}`)}
            disabled={coolingDown}
            className="flex flex-col items-center rounded-lg px-1 py-1 text-xl hover:bg-cream/10 disabled:opacity-40"
            onClick={() => {
              onPlay(sound)
              setCoolingDown(true)
              setTimeout(() => {
                setCoolingDown(false)
              }, SOUND_COOLDOWN_MS)
            }}
          >
            <span>{SOUND_ICONS[sound]}</span>
            <span className="text-[10px] leading-tight text-cream/60">{t(`sound.${sound}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
