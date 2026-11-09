import type { RoomPhase, RoundSettledMessage, TxFeedMessage } from '@jhandi/protocol/room'
import { useEffect, useRef } from 'react'
import { sfx } from '@/lib/sound'

const DICE_REST_MS = 4_200

// Plays sound effects from room state changes: shake while rolling, reveal on result,
// win/lose chime for my own round, a coin click for every bet in the room.
export const useRoomSounds = (input: {
  phase: RoomPhase | undefined
  lastResult: RoundSettledMessage | null
  roundId: string | undefined
  feed: TxFeedMessage[]
  secondsLeft: number
}) => {
  const { phase, lastResult, roundId, feed, secondsLeft } = input
  const previousPhase = useRef<RoomPhase | undefined>(undefined)
  const playedResult = useRef<string | null>(null)
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenFeed = useRef<TxFeedMessage | null>(null)

  useEffect(() => {
    if (phase === previousPhase.current) return
    if (phase === 'ROLLING') sfx('shake')
    if (phase === 'RESULT') sfx('reveal')
    previousPhase.current = phase
  }, [phase])

  useEffect(() => {
    if (
      !lastResult ||
      lastResult.roundId !== roundId ||
      playedResult.current === lastResult.roundId
    )
      return
    playedResult.current = lastResult.roundId
    const net = lastResult.yourNet
    if (net === 0) return
    // The result arrives when the cup starts shaking; cheer or cry only once the dice have
    // landed (1.4 s shake + 2.6 s throw), or the sound would give the result away.
    const timer = setTimeout(() => {
      sfx(net > 0 ? 'win' : 'lose')
    }, DICE_REST_MS)
    resultTimer.current = timer
  }, [lastResult, roundId])

  useEffect(
    () => () => {
      if (resultTimer.current) clearTimeout(resultTimer.current)
    },
    [],
  )

  useEffect(() => {
    const latest = feed[0] ?? null
    if (!latest || latest === seenFeed.current) return
    seenFeed.current = latest
    if (latest.type === 'BET') sfx('coin')
    if (latest.type === 'CANCEL') sfx('cancel')
  }, [feed])

  useEffect(() => {
    if (phase === 'BETTING' && secondsLeft > 0 && secondsLeft <= 3) sfx('tick')
  }, [phase, secondsLeft])
}
