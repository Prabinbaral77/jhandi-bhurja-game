import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import SymbolIcon from '@/components/art/SymbolIcon'
import VenueBackdrop from '@/components/art/VenueBackdrop'
import Button from '@/components/Button'
import CoinAmount from '@/components/CoinAmount'
import Board from '@/components/room/Board'
import ChipPicker from '@/components/room/ChipPicker'
import DiceArena from '@/components/room/DiceArena'
import FloatingReactions from '@/components/room/FloatingReactions'
import HostControls from '@/components/room/HostControls'
import InvitePanel from '@/components/room/InvitePanel'
import ResultBanner from '@/components/room/ResultBanner'
import SidePanel from '@/components/room/SidePanel'
import { useJhandiRoom } from '@/hooks/useJhandiRoom'
import { useRoomSounds } from '@/hooks/useRoomSounds'
import { useSecondsLeft } from '@/hooks/useSecondsLeft'
import { useAuthStore } from '@/lib/authStore'
import { isMessageKey, useT } from '@/lib/i18n'
import { useRoomStore } from '@/lib/roomStore'
import { isVenue } from '@/lib/venues'

const isSymbol = (value: string): value is GameSymbol =>
  (SYMBOLS as readonly string[]).includes(value)

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const t = useT()
  const actions = useJhandiRoom(roomId)
  const auth = useAuthStore((s) => s.auth)
  const {
    snapshot,
    wallet,
    myBets,
    lastResult,
    lastError,
    connection,
    connectionError,
    closedReason,
    feed,
  } = useRoomStore()
  const [chip, setChip] = useState(10)
  const secondsLeft = useSecondsLeft(snapshot?.phase === 'BETTING' ? snapshot.bettingEndsAt : 0)
  useRoomSounds({
    phase: snapshot?.phase,
    lastResult,
    roundId: snapshot?.roundId,
    feed,
    secondsLeft,
  })

  if (connection === 'closed' && connectionError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-tika">
          {connectionError === 'REMOVED'
            ? t('youWereRemoved')
            : connectionError === 'OPENED_ELSEWHERE'
              ? t('openedElsewhere')
              : t('connectionLost')}
        </p>
        <Link to="/rooms" className="text-marigold underline">
          {t('backToRooms')}
        </Link>
      </div>
    )
  }
  if (connection === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-tika">{connectionError ?? t('connectionLost')}</p>
        <Link to="/rooms" className="text-marigold underline">
          {t('backToRooms')}
        </Link>
      </div>
    )
  }
  if (!snapshot) return <p className="text-cream/60">{t('connecting')}</p>

  const userId = auth.status === 'signedIn' ? auth.user.id : ''
  const me = snapshot.members[userId]
  const isHost = snapshot.hostId === userId
  const isPlayer = me?.role === 'PLAYER'
  const canBet = isPlayer && snapshot.phase === 'BETTING'
  const roundBets = myBets?.roundId === snapshot.roundId ? myBets.bets : {}
  // The picked chip can't be below the room minimum.
  const betChip = Math.max(chip, snapshot.minBet)
  const errorKey = lastError ? `error.${lastError.code}` : null

  const venue = isVenue(snapshot.venue) ? snapshot.venue : 'NYATAPOLA'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <header className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-2xl">
          <VenueBackdrop venue={venue} className="h-40 w-full sm:h-48" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
            <div>
              <h1 className="text-2xl font-bold">{snapshot.name}</h1>
              <p className="text-sm text-cream/80">
                {t(`venue.${venue}`)} · {t('round')} #{snapshot.roundNo} · {t('bank')}{' '}
                <CoinAmount amount={snapshot.bankBalance} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-marigold">
                {t(`phase.${snapshot.phase}`)}
                {snapshot.phase === 'BETTING' &&
                  snapshot.bettingEndsAt > 0 &&
                  ` · ${t('timeLeft', { s: secondsLeft })}`}
              </p>
              {wallet !== null && (
                <p className="text-sm">
                  <CoinAmount amount={wallet} />
                </p>
              )}
            </div>
          </div>
        </header>

        {snapshot.phase === 'PAUSED' && snapshot.pausedReason && (
          <p className="rounded-lg bg-cream/10 p-3 text-sm">
            {isMessageKey(`paused.${snapshot.pausedReason}`)
              ? t(`paused.${snapshot.pausedReason}` as 'paused.HOST_PAUSED')
              : snapshot.pausedReason}
          </p>
        )}
        {(closedReason !== null || snapshot.phase === 'CLOSED') && (
          <p className="rounded-lg bg-tika/15 p-3">
            {t('roomClosed')}{' '}
            <Link to="/rooms" className="text-marigold underline">
              {t('backToRooms')}
            </Link>
          </p>
        )}

        <DiceArena dice={snapshot.lastDice} phase={snapshot.phase} roundId={snapshot.roundId} />
        {snapshot.history[0] && snapshot.phase !== 'RESULT' && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-cream/70">
            <span>{t('lastResults')}:</span>
            {snapshot.history[0]
              .split(',')
              .map((d, i) => (isSymbol(d) ? <SymbolIcon key={i} symbol={d} size={26} /> : null))}
          </div>
        )}
        {snapshot.phase === 'RESULT' && lastResult?.roundId === snapshot.roundId && (
          <ResultBanner result={lastResult} isHost={isHost} />
        )}

        <div className="mx-auto w-full max-w-2xl">
          <Board
            snapshot={snapshot}
            myBets={roundBets}
            canBet={canBet}
            onBet={(symbol: GameSymbol) => {
              actions.placeBet(symbol, betChip)
            }}
            onCancel={actions.cancelBet}
          />
        </div>

        {errorKey && (
          <p role="alert" className="text-sm text-tika">
            {isMessageKey(errorKey) ? t(errorKey) : lastError?.message}
          </p>
        )}

        {isPlayer && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-cream/60">
              {t('tapToBet')}
              {snapshot.phase === 'BETTING' && ` · ${t('untilHostShakes')}`}
            </p>
            <ChipPicker
              value={chip}
              minBet={snapshot.minBet}
              maxBet={snapshot.maxBetPerSymbol}
              onChange={setChip}
            />
          </div>
        )}
        {!isHost && !isPlayer && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-cream/70">{t('spectating')}</span>
            <Button onClick={actions.joinAsPlayer}>{t('joinAsPlayer')}</Button>
          </div>
        )}
        {isHost && snapshot.isPrivate && <InvitePanel roomId={roomId} />}
        {isHost && <HostControls snapshot={snapshot} actions={actions} />}

        <p className="break-all text-xs text-cream/40">
          {t('seedHash')}: {snapshot.seedHash || '—'}
        </p>
      </div>
      <div className="rounded-2xl border border-cream/10 p-4">
        <SidePanel snapshot={snapshot} actions={actions} canRemove={isHost && snapshot.isPrivate} />
      </div>
      <FloatingReactions />
    </div>
  )
}
