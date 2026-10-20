import type { TickerItem } from '@jhandi/protocol/lobby'
import { matchMaker } from '@colyseus/core'

// Presence pub/sub reaches every node when Redis presence is configured.
export const TICKER_CHANNEL = 'jhandi:ticker'

export const publishTicker = (item: TickerItem): void => {
  matchMaker.presence.publish(TICKER_CHANNEL, JSON.stringify(item))
}
