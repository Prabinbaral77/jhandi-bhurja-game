import { LobbyRoom, matchMaker, type Client } from '@colyseus/core'
import {
  LOBBY_MESSAGES,
  TICKER_HISTORY,
  tickerItemSchema,
  type RoomLiveSummary,
  type TickerItem,
} from '@jhandi/protocol/lobby'
import { z } from 'zod'
import { accessTokens } from '#lib/accessTokens'
import { TICKER_CHANNEL } from '#lib/ticker'
import { findUser } from '#repositories/roomRepository'

const joinOptionsSchema = z.object({ accessToken: z.string().min(1) })

/**
 * Live list of public rooms (docs/architecture.md §5.3). Colyseus' LobbyRoom already streams
 * every room's metadata (`rooms`, `+`, `-`); this adds sign-in and the global big-win ticker.
 */
export class JhandiLobbyRoom extends LobbyRoom<RoomLiveSummary> {
  override maxClients = 2_000
  private readonly ticker: TickerItem[] = []
  private readonly onTicker = (raw: string) => {
    const parsed = tickerItemSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return
    this.ticker.unshift(parsed.data)
    if (this.ticker.length > TICKER_HISTORY) this.ticker.pop()
    this.broadcast(LOBBY_MESSAGES.ticker, [parsed.data])
  }

  override async onCreate(options: unknown): Promise<void> {
    await super.onCreate(options)
    await matchMaker.presence.subscribe(TICKER_CHANNEL, this.onTicker)
  }

  override async onAuth(_client: Client, options: unknown): Promise<{ userId: string }> {
    const { accessToken } = joinOptionsSchema.parse(options)
    const userId = await accessTokens.verify(accessToken)
    const user = await findUser(userId)
    if (user?.status !== 'ACTIVE') throw new Error('Account not active')
    return { userId }
  }

  override onJoin(client: Client): void {
    // The base class keeps per-client filter options; we use none (clients filter locally).
    super.onJoin(client as Parameters<LobbyRoom['onJoin']>[0], {})
    client.send(LOBBY_MESSAGES.ticker, this.ticker)
  }

  override onDispose(): void {
    super.onDispose()
    matchMaker.presence.unsubscribe(TICKER_CHANNEL, this.onTicker)
  }
}
