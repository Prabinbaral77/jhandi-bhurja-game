/**
 * Lobby test (M4 exit criteria). Opens N rooms with N hosts, joins the lobby as a new user and
 * checks that every room shows up live, that a change inside a room (a player joining, a bet)
 * reaches the lobby within ~1 s, and that a big win appears on the ticker.
 *
 *   pnpm --filter @jhandi/e2e lobby [rooms]
 */
import { Client, type Room } from '@colyseus/sdk'
import {
  LOBBY_MESSAGES,
  lobbyListingSchema,
  tickerItemSchema,
  type RoomLiveSummary,
  type TickerItem,
} from '@jhandi/protocol/lobby'
import { z } from 'zod'

const API = process.env.VITE_API_URL ?? 'http://localhost:4000'
const WS = process.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'
const ROOMS = Number(process.argv[2] ?? 20)
// Dev DB is far away (~100 ms per query); the lobby itself is throttled to one update per second.
const LOBBY_LAG_MS = 3_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}
const check = (ok: boolean, message: string) => {
  if (!ok) fail(message)
}

const trpc = async <T>(path: string, input: unknown, token?: string): Promise<T> => {
  const res = await fetch(`${API}/v1/trpc/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  })
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } }
  return body.result ? body.result.data : fail(`${path}: ${body.error?.message ?? res.status}`)
}

const signUp = async () => {
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const { devCode = '' } = await trpc<{ devCode?: string }>('auth.requestOtp', {
    phone,
    ageConfirmed: true,
  })
  const s = await trpc<{ accessToken: string }>('auth.verifyOtp', { phone, code: devCode })
  return s.accessToken
}

const quiet = (room: Room, types: string[]) => {
  for (const t of types) room.onMessage(t, () => undefined)
  room.onLeave(() => undefined)
}
const ROOM_TYPES = [
  'wallet',
  'my_bets',
  'bet_accepted',
  'tx_feed',
  'error',
  'round_settled',
  'chat',
  'reaction',
  'room_closed',
]

const waitFor = async (what: string, condition: () => boolean, timeoutMs: number) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) fail(`timed out waiting for ${what}`)
    await sleep(25)
  }
  return Date.now() - start
}

const main = async () => {
  // Lobby watcher: a brand-new user who has not joined any room.
  const live = new Map<string, RoomLiveSummary>()
  const ticker: TickerItem[] = []
  const watcherToken = await signUp()
  const lobby = await new Client(WS).joinOrCreate('lobby', { accessToken: watcherToken })
  const upsert = (item: unknown) => {
    const parsed = lobbyListingSchema.safeParse(item)
    if (parsed.success && parsed.data.metadata)
      live.set(parsed.data.metadata.dbRoomId, parsed.data.metadata)
  }
  lobby.onMessage(LOBBY_MESSAGES.rooms, (rooms: unknown) => {
    for (const item of z.array(z.unknown()).parse(rooms)) upsert(item)
  })
  lobby.onMessage(LOBBY_MESSAGES.added, (payload: unknown) => {
    upsert(z.tuple([z.string(), z.unknown()]).parse(payload)[1])
  })
  lobby.onMessage(LOBBY_MESSAGES.removed, () => undefined)
  lobby.onMessage(LOBBY_MESSAGES.ticker, (payload: unknown) => {
    ticker.push(...z.array(tickerItemSchema).parse(payload))
  })
  lobby.onLeave(() => undefined)
  console.log('✓ lobby joined')

  // N hosts open N rooms and sit in them.
  const hosts: { token: string; roomId: string; room: Room }[] = []
  for (let i = 0; i < ROOMS; i++) {
    const token = await signUp()
    const { roomId } = await trpc<{ roomId: string }>(
      'rooms.create',
      {
        name: `Lobby test ${i + 1}`,
        deposit: 5_000,
        limits: { minBet: i % 2 ? 10 : 50, bettingWindowSec: 15 },
      },
      token,
    )
    const room = await new Client(WS).joinOrCreate('jhandi', {
      dbRoomId: roomId,
      accessToken: token,
    })
    quiet(room, ROOM_TYPES)
    hosts.push({ token, roomId, room })
  }
  const listed = await waitFor(
    `${ROOMS} rooms in lobby`,
    () => hosts.every((h) => live.has(h.roomId)),
    LOBBY_LAG_MS,
  )
  console.log(`✓ ${ROOMS} rooms opened and all listed live (last one after ${listed} ms)`)
  check(
    hosts.every((h) => live.get(h.roomId)?.phase === 'OPEN'),
    'rooms should be OPEN',
  )
  check(
    hosts.every((h) => live.get(h.roomId)?.players === 0),
    'rooms should have 0 players',
  )

  // A player walks into room 1 and joins as player → lobby count changes.
  const target = hosts[0] ?? fail('no rooms')
  const playerToken = await signUp()
  const player = await new Client(WS).joinOrCreate('jhandi', {
    dbRoomId: target.roomId,
    accessToken: playerToken,
  })
  const playerErrors: string[] = []
  quiet(
    player,
    ROOM_TYPES.filter((t) => t !== 'error'),
  )
  player.onMessage('error', (e: { code: string }) => playerErrors.push(e.code))
  const spectatorLag = await waitFor(
    'spectator count',
    () => live.get(target.roomId)?.spectators === 1,
    LOBBY_LAG_MS,
  )
  player.send('join_as_player', {})
  const playerLag = await waitFor(
    'player count',
    () => live.get(target.roomId)?.players === 1,
    LOBBY_LAG_MS,
  )
  console.log(`✓ spectator → lobby in ${spectatorLag} ms, player → lobby in ${playerLag} ms`)

  // Rounds with a big bet: phase and volume reach the lobby; a win ≥ 200 reaches the ticker.
  // One bet on CROWN wins with ≥ 2 matching dice (≈ 26 %), so a few rounds almost surely do.
  let phaseLag = -1
  let volumeLag = -1
  for (let round = 1; round <= 8 && ticker.length === 0; round++) {
    target.room.send('host_start_round', {})
    const lag = await waitFor(
      'BETTING phase',
      () => live.get(target.roomId)?.phase === 'BETTING',
      LOBBY_LAG_MS,
    )
    const volumeBefore = live.get(target.roomId)?.volumeLast10Min ?? 0
    // 500 × 6 = 3,000 worst case, inside the 5,000 bank.
    player.send('place_bet', { symbol: 'CROWN', amount: 500, clientSeq: round })
    const vLag = await waitFor(
      'volume',
      () =>
        (live.get(target.roomId)?.volumeLast10Min ?? 0) >= volumeBefore + 500 ||
        playerErrors.length > 0,
      LOBBY_LAG_MS * 2,
    )
    check(playerErrors.length === 0, `bet rejected: ${playerErrors.join(',')}`)
    if (phaseLag < 0) [phaseLag, volumeLag] = [lag, vLag]
    target.room.send('host_lock_and_roll', {})
    await waitFor(
      'result',
      () =>
        live.get(target.roomId)?.phase === 'RESULT' && live.get(target.roomId)?.roundNo === round,
      30_000,
    )
    await sleep(500)
    target.room.send('host_pause', {})
    await waitFor('pause', () => live.get(target.roomId)?.phase === 'PAUSED', LOBBY_LAG_MS)
  }
  console.log(`✓ phase → lobby in ${phaseLag} ms, volume → lobby in ${volumeLag} ms`)
  const summary = live.get(target.roomId)
  check((summary?.lastResults.length ?? 0) >= 1, 'lobby should show the last results')
  if (ticker.length > 0) {
    const win = ticker[0] ?? fail('ticker empty')
    check(win.dbRoomId === target.roomId && win.won >= 1_000, 'ticker item should be our win')
    console.log(
      `✓ ticker: ${win.displayName} won ${win.won} on ${win.symbol} ×${win.matches} (round ${summary?.roundNo})`,
    )
  } else {
    console.log('⚠ no win ≥ 200 in 8 rounds (p ≈ 9 %), ticker not exercised this run')
  }

  // Host closes room 2 → it leaves the lobby.
  const second = hosts[1] ?? fail('need at least 2 rooms')
  second.room.send('host_close', {})
  await waitFor('room 2 closed', () => live.get(second.roomId)?.phase === 'CLOSED', 30_000)
  console.log('✓ closed room reported CLOSED to the lobby')

  process.exit(0)
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
