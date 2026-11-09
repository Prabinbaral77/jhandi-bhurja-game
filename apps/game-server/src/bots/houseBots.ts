import { Client, type Room } from '@colyseus/sdk'
import { newId } from '@jhandi/db/ids'
import { users } from '@jhandi/db/schema/users'
import { getBalance, getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import {
  ROOM_CLIENT_MESSAGES as OUT,
  VENUES,
  roomSnapshotSchema,
  type RoomSnapshot,
} from '@jhandi/protocol/room'
import { and, eq } from 'drizzle-orm'
import { db } from '#lib/db'
import { env } from '#lib/env'
import { logger } from '#lib/logger'

/**
 * House tables: bot hosts that keep a public room open so a visitor always finds a game.
 * Each bot is an ordinary user (flag `is_bot`, no login identity) with its own wallet and one
 * room, and it hosts through the same WebSocket messages a human host sends — no special path
 * in the room logic, same rules, same platform fee, same ledger.
 *
 * A bot only runs rounds while at least one guest is seated: empty tables stay open and
 * listed, but do not write a round to the database every few seconds for nobody.
 */

const START_DELAY_MS = 8_000 // guests settle in / look at the last result
const BETTING_MS = 25_000 // how long betting stays open before the bot shakes the dice
const TICK_MS = 2_000
const REJOIN_DELAY_MS = 5_000
const TOP_UP_CHUNK = 10_000

const botDisplayName = (table: string) => `${table} 🤖`

const ensureBotUser = async (table: string): Promise<string> => {
  const displayName = botDisplayName(table)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isBot, true), eq(users.displayName, displayName)))
  if (existing) return existing.id
  const id = newId()
  await db.insert(users).values({ id, displayName, isBot: true, ageConfirmedAt: new Date() })
  logger.info({ table, userId: id }, 'house bot user created')
  return id
}

// One-time grant per bot (idempotent key), through the ledger like every other coin.
const ensureFunded = async (userId: string): Promise<number> => {
  const { writeAudit } = await import('@jhandi/api/repositories/auditRepository')
  return db.transaction(async (tx) => {
    const accountId = await getOrCreateAccount(tx, 'USER', userId)
    const posted = await postTransaction(tx, {
      kind: 'ADJUSTMENT',
      idempotencyKey: `bot-fund:${userId}`,
      refType: 'USER',
      refId: userId,
      entries: [
        { accountId: SYSTEM_ACCOUNT_IDS.ADJUSTMENT, amount: -env.HOUSE_BOT_COINS },
        { accountId, amount: env.HOUSE_BOT_COINS },
      ],
    })
    if (posted.status === 'posted') {
      await writeAudit(tx, {
        actorId: null,
        action: 'coins.adjust',
        target: `user:${userId}`,
        data: { amount: env.HOUSE_BOT_COINS, reason: 'house bot starting balance' },
      })
    }
    return getBalance(tx, accountId)
  })
}

const ensureRoom = async (userId: string, table: string, index: number): Promise<string> => {
  const { createRoom, getMyActiveRoom } = await import('@jhandi/api/services/roomService')
  const active = await getMyActiveRoom(userId)
  if (active) return active.roomId
  const { roomId } = await createRoom(userId, {
    name: table,
    visibility: 'PUBLIC',
    venue: VENUES[index % VENUES.length] ?? 'NYATAPOLA',
    deposit: env.HOUSE_BOT_DEPOSIT,
    limits: {},
  })
  logger.info({ table, roomId }, 'house table opened')
  return roomId
}

const hostTable = (table: string, index: number, port: number): void => {
  let room: Room | null = null
  let snapshot: RoomSnapshot | null = null
  // One scheduled action at a time, keyed so a state echo cannot schedule it twice.
  let pendingKey = ''
  let pendingTimer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  const schedule = (key: string, delayMs: number, action: () => void) => {
    if (pendingKey === key) return
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingKey = key
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined
      action()
    }, delayMs)
  }
  const cancel = () => {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = undefined
    pendingKey = ''
  }

  const tick = () => {
    if (!room || !snapshot) return
    const guests = Object.values(snapshot.members).filter(
      (m) => m.role !== 'HOST' && m.connected,
    ).length
    const current = room
    switch (snapshot.phase) {
      case 'OPEN':
      case 'RESULT':
        if (snapshot.phase === 'OPEN' && guests > 0) {
          schedule(`start:${snapshot.roundNo}`, START_DELAY_MS, () => {
            current.send(OUT.hostStartRound, {})
          })
        } else if (guests === 0) cancel()
        break
      case 'BETTING':
        // Always finish a round that was started, even if everyone left meanwhile.
        schedule(`roll:${snapshot.roundId}`, BETTING_MS, () => {
          current.send(OUT.hostLockAndRoll, {})
        })
        break
      case 'PAUSED':
        if (guests === 0) {
          cancel()
        } else if (snapshot.pausedReason === 'BANK_LOW') {
          schedule(`topup:${snapshot.bankBalance}`, 3_000, () => {
            current.send(OUT.hostTopUp, { amount: TOP_UP_CHUNK, clientSeq: ++seq })
            pendingKey = ''
          })
        } else {
          schedule(`resume:${snapshot.roundNo}`, START_DELAY_MS, () => {
            current.send(OUT.hostStartRound, {})
            pendingKey = ''
          })
        }
        break
      default:
        break
    }
  }

  const connect = async (): Promise<void> => {
    const userId = await ensureBotUser(table)
    const balance = await ensureFunded(userId)
    const roomId = await ensureRoom(userId, table, index)
    const { issueAccessToken } = await import('@jhandi/api/services/tokenService')
    const { accessToken } = await issueAccessToken(userId)
    const joined = await new Client(`ws://127.0.0.1:${port}`).joinOrCreate('jhandi', {
      dbRoomId: roomId,
      accessToken,
    })
    room = joined
    logger.info({ table, roomId, balance }, 'house bot hosting')
    joined.onStateChange((state: { toJSON: () => unknown }) => {
      const parsed = roomSnapshotSchema.safeParse(state.toJSON())
      if (parsed.success) snapshot = parsed.data
      tick()
    })
    // The room also sends private messages; a host bot only needs the shared state.
    joined.onMessage('*', () => undefined)
    joined.onLeave((code: number) => {
      if (room !== joined) return
      room = null
      snapshot = null
      cancel()
      logger.warn({ table, code }, 'house bot left its table; rejoining')
      setTimeout(start, REJOIN_DELAY_MS).unref()
    })
  }

  const start = () => {
    connect().catch((error: unknown) => {
      logger.error({ err: error, table }, 'house bot could not host; retrying')
      setTimeout(start, REJOIN_DELAY_MS * 6).unref()
    })
  }

  // State changes drive the bot; the interval covers timers that fired while nothing changed.
  setInterval(tick, TICK_MS).unref()
  start()
}

export const startHouseBots = (port: number): void => {
  env.HOUSE_BOTS.forEach((table, index) => {
    // Stagger the start so four tables do not hit the database in the same second.
    setTimeout(() => {
      hostTable(table, index, port)
    }, index * 1_500).unref()
  })
}
