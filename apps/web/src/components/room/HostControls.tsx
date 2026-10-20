import type { RoomSnapshot } from '@jhandi/protocol/room'
import { useState } from 'react'
import Button from '@/components/Button'
import type { RoomActions } from '@/hooks/useJhandiRoom'
import { useT } from '@/lib/i18n'

const BUSY = new Set(['BETTING', 'LOCKED', 'ROLLING', 'SETTLING'])

export default function HostControls({
  snapshot,
  actions,
}: {
  snapshot: RoomSnapshot
  actions: RoomActions
}) {
  const t = useT()
  const [topUp, setTopUp] = useState(1_000)
  const [confirmClose, setConfirmClose] = useState(false)
  const busy = BUSY.has(snapshot.phase)
  const canStart = ['OPEN', 'PAUSED', 'RESULT'].includes(snapshot.phase)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-marigold/40 bg-marigold/5 p-4">
      <h2 className="font-semibold text-marigold">{t('host')}</h2>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canStart} onClick={actions.startRound}>
          {t('startRound')}
        </Button>
        <Button
          variant="secondary"
          disabled={snapshot.phase !== 'BETTING'}
          onClick={actions.rollNow}
        >
          {t('rollNow')}
        </Button>
        <Button variant="secondary" disabled={snapshot.phase === 'PAUSED'} onClick={actions.pause}>
          {t('pauseRoom')}
        </Button>
        {snapshot.isPrivate && (
          <Button
            variant="secondary"
            onClick={snapshot.isLocked ? actions.unlockRoom : actions.lockRoom}
          >
            {snapshot.isLocked ? t('unlockRoom') : t('lockRoom')}
          </Button>
        )}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (topUp > 0) actions.topUp(topUp)
        }}
      >
        <input
          type="number"
          min={1}
          step={100}
          value={topUp}
          onChange={(e) => {
            setTopUp(Math.max(0, Math.floor(Number(e.target.value))))
          }}
          className="w-28 rounded-lg border border-cream/20 bg-wood px-3 py-2 tabular-nums"
        />
        <Button type="submit" variant="secondary">
          {t('topUp')}
        </Button>
      </form>
      {confirmClose ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('confirmClose')}</span>
          <Button
            className="bg-tika text-cream hover:bg-tika/90"
            onClick={() => {
              actions.closeRoom()
              setConfirmClose(false)
            }}
          >
            {t('closeRoom')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmClose(false)
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="self-start text-tika"
          disabled={busy}
          onClick={() => {
            setConfirmClose(true)
          }}
        >
          {t('closeRoom')}
        </Button>
      )}
    </section>
  )
}
