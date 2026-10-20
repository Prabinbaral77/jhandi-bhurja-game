import type { RoomPhase, RoundSettledMessage, TxFeedMessage } from '@jhandi/protocol/room'
import { useEffect, useRef } from 'react'
import { sfx } from '@/lib/sound'

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
    if (lastResult.yourNet > 0) sfx('win')
    else if (lastResult.yourNet < 0) sfx('lose')
  }, [lastResult, roundId])

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
