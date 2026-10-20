import type { Bet } from '@jhandi/game-rules/bet'
import type { RoundSettlement } from '@jhandi/game-rules/settlement'
import { validateBet, type BetRejection } from '@jhandi/game-rules/betValidation'
import { ROLL_ANIMATION_SEC, roomLimitsSchema, type RoomLimits } from '@jhandi/game-rules/limits'
import { generateServerSeed, hashServerSeed, rollDice } from '@jhandi/game-rules/rng'
import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { AppError } from '@jhandi/protocol/appError'
import type { AppErrorShape } from '@jhandi/protocol/errors'
import {
  cancelBetMessageSchema,
  chatMessageSchema,
  emptyMessageSchema,
  placeBetMessageSchema,
  reactionMessageSchema,
  ROOM_CLIENT_MESSAGES as IN,
  ROOM_SERVER_MESSAGES as OUT,
  topUpMessageSchema,
  type RoomPhase,
  type RoundSettledMessage,
  type TxFeedMessage,
} from '@jhandi/protocol/room'
import { Room, type Client } from '@colyseus/core'
import { z } from 'zod'
import { accessTokens } from '#lib/accessTokens'
import { getSettings } from '#lib/db'
import { logger } from '#lib/logger'
import {
  findRoom,
  findUser,
  markMemberLeft,
  setRoomStatus,
  upsertMember,
} from '#repositories/roomRepository'
import { markRoundLocked, nextRoundNo, recentDice } from '#repositories/roundRepository'
import {
  balanceOf,
  closeRoomAndReturnBank,
  createRound,
  getBankAccount,
  getUserAccount,
  recordBet,
  refundBet,
  settleAndRecord,
  topUpBank,
  voidRound,
  voidUnfinishedRounds,
} from '#services/roundService'
import { JhandiState, MemberState, SymbolTotalState } from '#schemas/roomState'
import { createSerialQueue } from '#utils/serialQueue'
import { onValidatedMessage } from '#utils/onValidatedMessage'

interface AuthData {
  userId: string
  displayName: string
}

type JhandiClient = Client<{ auth: AuthData }>

interface ActiveRound {
  id: string
  no: number
  seed: string
  seedHash: string
  escrowAccountId: string
  // Key: `${userId}:${symbol}` — one merged amount per user and symbol.
  bets: Map<string, { userId: string; symbol: GameSymbol; amount: number }>
}

interface Timer {
  clear(): void
}

const createOptionsSchema = z.object({ dbRoomId: z.uuid() })
const joinOptionsSchema = z.object({ dbRoomId: z.uuid(), accessToken: z.string().min(1) })

const RECONNECT_WINDOW_SEC = 30
const HOST_AWAY_CLOSE_MS = 2 * 60 * 1000
const HISTORY_LENGTH = 20
const CHAT_MIN_INTERVAL_MS = 1_000

const BET_REJECTION_MESSAGES: Record<BetRejection, string> = {
  NOT_BETTING: 'Betting is closed for this round',
  NOT_A_PLAYER: 'Join as a player to place bets',
  BELOW_MIN: 'Bet is below the minimum',
  ABOVE_MAX: 'Bet is above the limit',
  INSUFFICIENT_BALANCE: 'Not enough coins',
  BANK_LIMIT_REACHED: "The host's bank can't cover this bet",
}

// The phases in which coins are moving; the host can't close or leave the room in these.
const BUSY_PHASES: readonly RoomPhase[] = ['BETTING', 'LOCKED', 'ROLLING', 'SETTLING']

const betKey = (userId: string, symbol: GameSymbol) => `${userId}:${symbol}`

/**
 * One Jhandi Burja table (docs/architecture.md §5.2). The Colyseus room is the single writer
 * for its table; every coin-moving step runs through `enqueue` so steps never interleave.
 */
export class JhandiRoom extends Room<{ state: JhandiState; client: JhandiClient }> {
  override maxClients = 200
  override state = new JhandiState()

  private dbRoomId = ''
  private hostId = ''
  private limits!: RoomLimits
  private bankAccountId = ''
  private hostAccountId = ''
  private round: ActiveRound | null = null
  private pauseAfterRound = false
  private closed = false
  private readonly enqueue = createSerialQueue()
  private readonly userAccounts = new Map<string, string>()
  // Wallet balances of people in the room, refreshed from every ledger write (saves a query per bet).
  private readonly wallets = new Map<string, number>()
  private readonly names = new Map<string, string>()
  private readonly lastChatAt = new Map<string, number>()
  private bettingTimer: Timer | undefined
  private phaseTimer: Timer | undefined
  private hostAwayTimer: Timer | undefined

  // ---------- lifecycle ----------

  override async onCreate(options: unknown): Promise<void> {
    const { dbRoomId } = createOptionsSchema.parse(options)
    const found = await findRoom(dbRoomId)
    if (!found || found.room.status === 'CLOSED') throw new Error('Room not found or closed')

    // A previous instance of this room may have died mid-round.
    await voidUnfinishedRounds(dbRoomId)

    this.dbRoomId = dbRoomId
    this.hostId = found.room.hostId
    this.limits = roomLimitsSchema.parse(found.room.config)
    this.bankAccountId = await getBankAccount(dbRoomId)
    this.hostAccountId = await getUserAccount(this.hostId)
    this.names.set(this.hostId, found.hostName)

    const state = this.state
    state.roomId = dbRoomId
    state.name = found.room.name
    state.hostId = this.hostId
    state.minBet = this.limits.minBet
    state.maxBetPerSymbol = this.limits.maxBetPerSymbol
    state.maxBetPerPlayerPerRound = this.limits.maxBetPerPlayerPerRound
    state.bankBalance = await balanceOf(this.bankAccountId)
    for (const symbol of SYMBOLS) state.board.set(symbol, new SymbolTotalState())
    for (const dice of await recentDice(dbRoomId, HISTORY_LENGTH)) {
      state.history.push(dice.map((face) => SYMBOLS[face] ?? '').join(','))
    }
    this.setPhase(found.room.status === 'PAUSED' ? 'PAUSED' : 'OPEN')

    this.registerMessages()
    logger.info({ roomId: dbRoomId, colyseusRoomId: this.roomId }, 'room created')
  }

  override async onAuth(_client: JhandiClient, options: unknown): Promise<AuthData> {
    const { accessToken } = joinOptionsSchema.parse(options)
    const userId = await accessTokens.verify(accessToken)
    const user = await findUser(userId)
    if (user?.status !== 'ACTIVE') throw new Error('Account not active')
    if (this.closed) throw new Error('Room is closed')
    return { userId, displayName: user.displayName }
  }

  override async onJoin(client: JhandiClient): Promise<void> {
    const { userId, displayName } = this.authOf(client)

    // One live connection per user: a new tab replaces the old one.
    for (const other of this.clients) {
      if (other !== client && other.auth?.userId === userId) other.leave(4001, 'Opened elsewhere')
    }

    const existing = this.state.members.get(userId)
    const role = userId === this.hostId ? 'HOST' : (existing?.role ?? 'SPECTATOR')
    const member = existing ?? new MemberState()
    member.userId = userId
    member.displayName = displayName
    member.role = role
    member.connected = true
    this.state.members.set(userId, member)
    this.names.set(userId, displayName)

    if (userId === this.hostId) {
      this.hostAwayTimer?.clear()
      this.hostAwayTimer = undefined
    }

    const accountId = await getUserAccount(userId)
    this.userAccounts.set(userId, accountId)
    this.wallets.set(userId, await balanceOf(accountId))
    await upsertMember(
      this.dbRoomId,
      userId,
      role === 'HOST' ? 'HOST' : role === 'PLAYER' ? 'PLAYER' : 'SPECTATOR',
    )
    this.sendPrivateState(client)
  }

  override async onDrop(client: JhandiClient): Promise<void> {
    const member = this.state.members.get(this.authOf(client).userId)
    if (member) member.connected = false
    await this.allowReconnection(client, RECONNECT_WINDOW_SEC)
  }

  override onReconnect(client: JhandiClient): void {
    const member = this.state.members.get(this.authOf(client).userId)
    if (member) member.connected = true
    this.sendPrivateState(client)
  }

  override async onLeave(client: JhandiClient): Promise<void> {
    const { userId } = this.authOf(client)
    // A newer connection of the same user already took over.
    if (this.clients.some((c) => c !== client && c.auth?.userId === userId)) return

    const member = this.state.members.get(userId)
    const hasOpenBets = [...(this.round?.bets.values() ?? [])].some((b) => b.userId === userId)
    if (member && (userId === this.hostId || hasOpenBets)) {
      member.connected = false
    } else {
      this.state.members.delete(userId)
    }
    await markMemberLeft(this.dbRoomId, userId)

    if (userId === this.hostId && !this.closed) this.onHostAway()
  }

  override async onDispose(): Promise<void> {
    this.clearTimers()
    // Nobody left to watch: refund an unfinished round instead of finishing it unseen.
    await this.enqueue(async () => {
      if (this.round) {
        await voidRound(this.round.id)
        this.round = null
      }
    })
    logger.info({ roomId: this.dbRoomId }, 'room disposed')
  }

  // ---------- messages ----------

  private registerMessages(): void {
    onValidatedMessage(this, IN.joinAsPlayer, emptyMessageSchema, (client: JhandiClient) => {
      void this.run(client, undefined, () => this.joinAsPlayer(client))
    })
    onValidatedMessage(this, IN.placeBet, placeBetMessageSchema, (client: JhandiClient, msg) => {
      void this.run(client, msg.clientSeq, () =>
        this.placeBet(client, msg.symbol, msg.amount, msg.clientSeq),
      )
    })
    onValidatedMessage(this, IN.cancelBet, cancelBetMessageSchema, (client: JhandiClient, msg) => {
      void this.run(client, msg.clientSeq, () => this.cancelBet(client, msg.symbol, msg.clientSeq))
    })
    onValidatedMessage(this, IN.hostStartRound, emptyMessageSchema, (client: JhandiClient) => {
      void this.run(client, undefined, () => {
        this.assertHost(client)
        this.pauseAfterRound = false
        return this.startRound()
      })
    })
    onValidatedMessage(this, IN.hostLockAndRoll, emptyMessageSchema, (client: JhandiClient) => {
      void this.run(client, undefined, () => {
        this.assertHost(client)
        return this.lockAndRoll()
      })
    })
    onValidatedMessage(this, IN.hostPause, emptyMessageSchema, (client: JhandiClient) => {
      void this.run(client, undefined, () => {
        this.assertHost(client)
        this.pauseAfterRound = true
        if (!BUSY_PHASES.includes(this.phase)) this.pause('HOST_PAUSED')
        return Promise.resolve()
      })
    })
    onValidatedMessage(this, IN.hostClose, emptyMessageSchema, (client: JhandiClient) => {
      void this.run(client, undefined, () => {
        this.assertHost(client)
        return this.closeRoom('HOST_CLOSED')
      })
    })
    onValidatedMessage(this, IN.hostTopUp, topUpMessageSchema, (client: JhandiClient, msg) => {
      void this.run(client, msg.clientSeq, () => this.topUp(client, msg.amount, msg.clientSeq))
    })
    onValidatedMessage(this, IN.chat, chatMessageSchema, (client: JhandiClient, msg) => {
      const { userId, displayName } = this.authOf(client)
      if (!this.allowChat(userId)) return
      this.broadcast(OUT.chat, { userId, displayName, text: msg.text, at: Date.now() })
    })
    onValidatedMessage(this, IN.reaction, reactionMessageSchema, (client: JhandiClient, msg) => {
      const { userId } = this.authOf(client)
      if (!this.allowChat(userId)) return
      this.broadcast(OUT.reaction, { userId, emoji: msg.emoji })
    })
  }

  // Queues a job and turns any failure into an `error` message for that client.
  private async run(client: JhandiClient, clientSeq: number | undefined, job: () => Promise<void>) {
    try {
      await this.enqueue(job)
    } catch (error) {
      const shape: AppErrorShape =
        error instanceof AppError
          ? error.toShape()
          : { code: 'INTERNAL', message: 'Something went wrong' }
      if (!(error instanceof AppError)) {
        logger.error({ err: error, roomId: this.dbRoomId }, 'room job failed')
      }
      client.send(OUT.error, clientSeq === undefined ? shape : { ...shape, clientSeq })
    }
  }

  private async joinAsPlayer(client: JhandiClient): Promise<void> {
    const { userId } = this.authOf(client)
    if (userId === this.hostId) return
    const member = this.state.members.get(userId)
    if (!member || member.role === 'PLAYER') return
    member.role = 'PLAYER'
    await upsertMember(this.dbRoomId, userId, 'PLAYER')
  }

  private async placeBet(
    client: JhandiClient,
    symbol: GameSymbol,
    amount: number,
    clientSeq: number,
  ): Promise<void> {
    const { userId, displayName } = this.authOf(client)
    const round = this.round
    const userAccountId = this.userAccounts.get(userId)
    if (!round || !userAccountId)
      throw new AppError('NOT_BETTING', BET_REJECTION_MESSAGES.NOT_BETTING)

    const rejection = validateBet({
      isBettingOpen: this.phase === 'BETTING',
      isPlayer: this.state.members.get(userId)?.role === 'PLAYER',
      isHost: userId === this.hostId,
      userId,
      symbol,
      amount,
      walletBalance: this.wallets.get(userId) ?? (await balanceOf(userAccountId)),
      bankBefore: this.state.bankBalance,
      limits: this.limits,
      roundBets: [...round.bets.values()],
    })
    if (rejection) throw new AppError(rejection, BET_REJECTION_MESSAGES[rejection])

    const { duplicate, balance } = await recordBet({
      roundId: round.id,
      userId,
      userAccountId,
      escrowAccountId: round.escrowAccountId,
      symbol,
      amount,
      // Session id survives reconnects; clientSeq restarts with each new connection.
      idempotencyKey: `bet:${round.id}:${client.sessionId}:${clientSeq}`,
    })
    if (balance !== undefined) this.wallets.set(userId, balance)
    if (!duplicate) {
      const key = betKey(userId, symbol)
      const existing = round.bets.get(key)
      round.bets.set(key, { userId, symbol, amount: (existing?.amount ?? 0) + amount })
      this.refreshBoard()
      this.feed({ type: 'BET', displayName, symbol, amount, at: Date.now() })
    }
    client.send(OUT.betAccepted, { clientSeq })
    this.sendPrivateState(client)
  }

  private async cancelBet(
    client: JhandiClient,
    symbol: GameSymbol,
    clientSeq: number,
  ): Promise<void> {
    const { userId, displayName } = this.authOf(client)
    const round = this.round
    if (!round || this.phase !== 'BETTING') {
      throw new AppError('NOT_BETTING', BET_REJECTION_MESSAGES.NOT_BETTING)
    }
    const key = betKey(userId, symbol)
    const bet = round.bets.get(key)
    const userAccountId = this.userAccounts.get(userId)
    if (!bet || !userAccountId) throw new AppError('NOT_FOUND', 'No bet on this symbol')

    const balance = await refundBet({
      roundId: round.id,
      userId,
      userAccountId,
      escrowAccountId: round.escrowAccountId,
      symbol,
      amount: bet.amount,
      idempotencyKey: `cancel:${round.id}:${client.sessionId}:${clientSeq}`,
    })
    if (balance !== undefined) this.wallets.set(userId, balance)
    round.bets.delete(key)
    this.refreshBoard()
    this.feed({ type: 'CANCEL', displayName, symbol, amount: bet.amount, at: Date.now() })
    this.sendPrivateState(client)
  }

  private async topUp(client: JhandiClient, amount: number, clientSeq: number): Promise<void> {
    this.assertHost(client)
    if (this.closed) throw new AppError('ROOM_CLOSED', 'Room is closed')
    const balances = await topUpBank({
      roomId: this.dbRoomId,
      hostAccountId: this.hostAccountId,
      bankAccountId: this.bankAccountId,
      amount,
      idempotencyKey: `topup:${this.dbRoomId}:${client.sessionId}:${clientSeq}`,
    })
    this.state.bankBalance =
      balances.get(this.bankAccountId) ?? (await balanceOf(this.bankAccountId))
    const hostBalance = balances.get(this.hostAccountId)
    if (hostBalance !== undefined) this.wallets.set(this.hostId, hostBalance)
    this.feed({
      type: 'BANK_TOPUP',
      displayName: this.authOf(client).displayName,
      amount,
      at: Date.now(),
    })
    this.sendPrivateState(client)
  }

  // ---------- round flow (always called inside enqueue) ----------

  private async startRound(): Promise<void> {
    if (this.closed || BUSY_PHASES.includes(this.phase)) return

    const { MIN_HOST_BANK_TO_CONTINUE } = await getSettings()
    if (this.state.bankBalance < MIN_HOST_BANK_TO_CONTINUE) {
      this.pause('BANK_LOW')
      return
    }

    const seed = generateServerSeed()
    const seedHash = hashServerSeed(seed)
    const roundNo = await nextRoundNo(this.dbRoomId)
    const { roundId, escrowAccountId } = await createRound({
      roomId: this.dbRoomId,
      roundNo,
      seedHash,
    })
    this.round = { id: roundId, no: roundNo, seed, seedHash, escrowAccountId, bets: new Map() }

    const state = this.state
    state.roundId = roundId
    state.roundNo = roundNo
    state.seedHash = seedHash
    state.lastDice.clear()
    state.pausedReason = ''
    this.refreshBoard()

    const windowMs = this.limits.bettingWindowSec * 1000
    state.bettingEndsAt = Date.now() + windowMs
    this.setPhase('BETTING')
    await setRoomStatus(this.dbRoomId, 'OPEN')
    for (const client of this.clients) this.sendPrivateState(client)

    this.bettingTimer = this.clock.setTimeout(() => {
      void this.enqueue(() => this.lockAndRoll()).catch((error: unknown) => {
        logger.error({ err: error, roomId: this.dbRoomId }, 'lock failed')
      })
    }, windowMs)
  }

  private async lockAndRoll(): Promise<void> {
    const round = this.round
    if (!round || this.phase !== 'BETTING') return
    this.bettingTimer?.clear()
    this.setPhase('LOCKED')
    await markRoundLocked(round.id)

    const dice = rollDice(round.seed, round.id)
    for (const symbol of dice) this.state.lastDice.push(symbol)
    this.setPhase('ROLLING')

    this.phaseTimer = this.clock.setTimeout(() => {
      void this.enqueue(() => this.settle(dice)).catch((error: unknown) => {
        logger.error({ err: error, roomId: this.dbRoomId }, 'settle failed')
      })
    }, ROLL_ANIMATION_SEC * 1000)
  }

  private async settle(dice: GameSymbol[]): Promise<void> {
    const round = this.round
    if (!round || this.phase !== 'ROLLING') return
    this.setPhase('SETTLING')

    const bets: Bet[] = [...round.bets.values()].map((b) => ({
      betId: betKey(b.userId, b.symbol),
      ...b,
    }))
    let result: RoundSettlement
    let balances: ReadonlyMap<string, number>
    const settleStartedAt = Date.now()
    try {
      const { PLATFORM_FEE_BPS } = await getSettings()
      ;({ result, balances } = await settleAndRecord({
        roundId: round.id,
        serverSeed: round.seed,
        dice,
        bets,
        bankBefore: this.state.bankBalance,
        feeBps: PLATFORM_FEE_BPS,
        bankAccountId: this.bankAccountId,
        escrowAccountId: round.escrowAccountId,
        userAccounts: this.userAccounts,
      }))
    } catch (error) {
      // Nothing was committed (one transaction), so refunding is always safe.
      logger.error({ err: error, roundId: round.id }, 'settlement failed, voiding round')
      await voidRound(round.id)
      await this.refreshWallets(bets.map((b) => b.userId))
      this.round = null
      this.pause('ERROR')
      for (const client of this.clients) this.sendPrivateState(client)
      return
    }

    logger.info(
      {
        roomId: this.dbRoomId,
        roundId: round.id,
        bets: bets.length,
        hostNet: result.hostNet,
        platformFee: result.platformFee,
        ms: Date.now() - settleStartedAt,
      },
      'round settled',
    )
    this.round = null
    this.state.bankBalance = result.bankAfter
    for (const [userId, accountId] of this.userAccounts) {
      const balance = balances.get(accountId)
      if (balance !== undefined) this.wallets.set(userId, balance)
    }
    this.state.history.unshift(dice.join(','))
    while (this.state.history.length > HISTORY_LENGTH) this.state.history.pop()
    this.setPhase('RESULT')

    const netByUser = new Map<string, number>()
    for (const bet of result.bets) {
      netByUser.set(
        bet.userId,
        (netByUser.get(bet.userId) ?? 0) + (bet.won ? bet.winnings : -bet.amount),
      )
      if (bet.won) {
        this.feed({
          type: 'WIN',
          displayName: this.names.get(bet.userId) ?? '',
          symbol: bet.symbol,
          amount: bet.winnings,
          at: Date.now(),
        })
      }
    }
    const message: Omit<RoundSettledMessage, 'yourNet'> = {
      roundId: round.id,
      roundNo: round.no,
      dice,
      seedHash: round.seedHash,
      serverSeed: round.seed,
      winners: result.bets
        .filter((b) => b.won)
        .map((b) => ({
          userId: b.userId,
          displayName: this.names.get(b.userId) ?? '',
          symbol: b.symbol,
          won: b.winnings,
        })),
      hostNet: result.hostNet,
      platformFee: result.platformFee,
      bankAfter: result.bankAfter,
    }
    for (const client of this.clients) {
      const userId = this.authOf(client).userId
      const yourNet =
        userId === this.hostId ? result.hostNet - result.platformFee : (netByUser.get(userId) ?? 0)
      client.send(OUT.roundSettled, { ...message, yourNet })
      this.sendPrivateState(client)
    }

    this.phaseTimer = this.clock.setTimeout(() => {
      void this.enqueue(() => this.afterResult()).catch((error: unknown) => {
        logger.error({ err: error, roomId: this.dbRoomId }, 'next round failed')
      })
    }, this.limits.resultDisplaySec * 1000)
  }

  private async afterResult(): Promise<void> {
    if (this.phase !== 'RESULT' || this.closed) return
    const hostOnline = this.state.members.get(this.hostId)?.connected === true
    if (this.pauseAfterRound) {
      this.pause('HOST_PAUSED')
    } else if (!hostOnline) {
      this.pause('HOST_AWAY')
    } else {
      await this.startRound()
    }
  }

  private pause(reason: 'HOST_PAUSED' | 'HOST_AWAY' | 'BANK_LOW' | 'ERROR'): void {
    this.state.pausedReason = reason
    this.setPhase('PAUSED')
    void setRoomStatus(this.dbRoomId, 'PAUSED').catch((error: unknown) => {
      logger.error({ err: error, roomId: this.dbRoomId }, 'failed to save room status')
    })
  }

  private onHostAway(): void {
    this.pauseAfterRound = true
    if (this.phase === 'OPEN' || this.phase === 'RESULT') {
      void this.enqueue(() => {
        if (!BUSY_PHASES.includes(this.phase)) this.pause('HOST_AWAY')
        return Promise.resolve()
      })
    }
    this.hostAwayTimer?.clear()
    this.hostAwayTimer = this.clock.setTimeout(() => {
      void this.enqueue(() => this.closeRoom('HOST_AWAY')).catch((error: unknown) => {
        logger.error({ err: error, roomId: this.dbRoomId }, 'auto-close failed')
      })
    }, HOST_AWAY_CLOSE_MS)
  }

  private async closeRoom(reason: string): Promise<void> {
    if (this.closed) return
    if (BUSY_PHASES.includes(this.phase)) {
      throw new AppError('FORBIDDEN', 'Wait for the current round to finish')
    }
    this.closed = true
    this.clearTimers()
    const returned = await closeRoomAndReturnBank({
      roomId: this.dbRoomId,
      hostAccountId: this.hostAccountId,
      bankAccountId: this.bankAccountId,
    })
    this.state.bankBalance = 0
    this.wallets.set(this.hostId, await balanceOf(this.hostAccountId))
    this.setPhase('CLOSED')
    logger.info({ roomId: this.dbRoomId, reason, returned }, 'room closed')
    this.broadcast(OUT.roomClosed, { reason })
    for (const client of this.clients) this.sendPrivateState(client)
    this.clock.setTimeout(() => void this.disconnect(), 3_000)
  }

  // ---------- helpers ----------

  private get phase(): RoomPhase {
    return this.state.phase as RoomPhase
  }

  private setPhase(phase: RoomPhase): void {
    this.state.phase = phase
  }

  private authOf(client: JhandiClient): AuthData {
    if (!client.auth) throw new Error('Client has no auth data')
    return client.auth
  }

  private assertHost(client: JhandiClient): void {
    if (this.authOf(client).userId !== this.hostId) {
      throw new AppError('FORBIDDEN', 'Only the host can do this')
    }
  }

  private refreshBoard(): void {
    const totals = new Map<GameSymbol, { total: number; bettors: number }>()
    for (const bet of this.round?.bets.values() ?? []) {
      const entry = totals.get(bet.symbol) ?? { total: 0, bettors: 0 }
      entry.total += bet.amount
      entry.bettors += 1
      totals.set(bet.symbol, entry)
    }
    for (const symbol of SYMBOLS) {
      const tile = this.state.board.get(symbol)
      if (!tile) continue
      tile.total = totals.get(symbol)?.total ?? 0
      tile.bettors = totals.get(symbol)?.bettors ?? 0
    }
  }

  private feed(entry: TxFeedMessage): void {
    this.broadcast(OUT.txFeed, entry)
  }

  // Wallet balance and own bets: private, so sent per client rather than in shared state.
  private sendPrivateState(client: JhandiClient): void {
    const { userId } = this.authOf(client)
    const balance = this.wallets.get(userId)
    if (balance !== undefined) client.send(OUT.wallet, { balance })
    const round = this.round
    if (round) {
      const mine: Partial<Record<GameSymbol, number>> = {}
      for (const bet of round.bets.values())
        if (bet.userId === userId) mine[bet.symbol] = bet.amount
      client.send(OUT.myBets, { roundId: round.id, bets: mine })
    }
  }

  private async refreshWallets(userIds: Iterable<string>): Promise<void> {
    for (const userId of new Set(userIds)) {
      const accountId = this.userAccounts.get(userId)
      if (accountId) this.wallets.set(userId, await balanceOf(accountId))
    }
  }

  private allowChat(userId: string): boolean {
    const now = Date.now()
    if (now - (this.lastChatAt.get(userId) ?? 0) < CHAT_MIN_INTERVAL_MS) return false
    this.lastChatAt.set(userId, now)
    return true
  }

  private clearTimers(): void {
    this.bettingTimer?.clear()
    this.phaseTimer?.clear()
    this.hostAwayTimer?.clear()
  }
}
