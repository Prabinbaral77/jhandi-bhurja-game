/**
 * End-to-end smoke test against running api + game-server (pnpm dev).
 * Signs up a host and two players, opens a room, plays N rounds with random bets and checks
 * every coin: wallets, bank, fairness proof, and finally closes the room.
 *
 *   pnpm --filter @jhandi/e2e smoke [rounds]
 */
import { Client, type Room } from '@colyseus/sdk'
import { verifyRoll } from '@jhandi/game-rules/rng'
import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import {
  roomSnapshotSchema,
  roundSettledMessageSchema,
  walletMessageSchema,
  type RoomSnapshot,
  type RoundSettledMessage,
} from '@jhandi/protocol/room'

const API = process.env.VITE_API_URL ?? 'http://localhost:4000'
const WS = process.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'
const ROUNDS = Number(process.argv[2] ?? 10)

const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}
const check = (ok: boolean, message: string) => {
  if (!ok) fail(message)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const trpc = async <T>(
  path: string,
  input: unknown,
  token?: string,
  method = 'POST',
): Promise<T> => {
  const url =
    method === 'GET'
      ? `${API}/v1/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${API}/v1/trpc/${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
  })
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } }
  if (!body.result) fail(`${path}: ${body.error?.message ?? res.status}`)
  return (body.result as { data: T }).data
}

const signUp = async () => {
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const { devCode } = await trpc<{ devCode?: string }>('auth.requestOtp', {
    phone,
    ageConfirmed: true,
  })
  if (!devCode) return fail('API must run with SMS_PROVIDER=console')
  const session = await trpc<{ accessToken: string; user: { id: string; displayName: string } }>(
    'auth.verifyOtp',
    { phone, code: devCode },
  )
  return { token: session.accessToken, ...session.user }
}

interface Seat {
  name: string
  room: Room
  snapshot: RoomSnapshot | null
  wallet: number
  settled: RoundSettledMessage[]
  errors: string[]
}

const connect = async (name: string, token: string, dbRoomId: string): Promise<Seat> => {
  const room = await new Client(WS).joinOrCreate('jhandi', { dbRoomId, accessToken: token })
  const seat: Seat = { name, room, snapshot: null, wallet: -1, settled: [], errors: [] }
  room.onStateChange((state: { toJSON: () => unknown }) => {
    const parsed = roomSnapshotSchema.safeParse(state.toJSON())
    if (parsed.success) seat.snapshot = parsed.data
  })
  room.onMessage('wallet', (m: unknown) => {
    seat.wallet = walletMessageSchema.parse(m).balance
  })
  room.onMessage('round_settled', (m: unknown) =>
    seat.settled.push(roundSettledMessageSchema.parse(m)),
  )
  room.onMessage('error', (m: { code: string }) => seat.errors.push(m.code))
  for (const type of ['my_bets', 'bet_accepted', 'tx_feed', 'chat', 'reaction', 'room_closed']) {
    room.onMessage(type, () => undefined)
  }
  return seat
}

let seats: Seat[] = []

const describeSeats = () =>
  seats
    .map(
      (s) =>
        `${s.name}: phase=${s.snapshot?.phase ?? '?'} wallet=${s.wallet} settled=${s.settled.length} errors=[${s.errors.join(',')}]`,
    )
    .join('\n  ')

// Generous: in development every DB query crosses Nepal → Mumbai (~100 ms), and a room handles
// its jobs one at a time, so a round with many bets takes a while to settle.
const waitFor = async (what: string, condition: () => boolean, timeoutMs = 60_000) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) fail(`timed out waiting for ${what}\n  ${describeSeats()}`)
    await sleep(50)
  }
}

const main = async () => {
  const host = await signUp()
  const ram = await signUp()
  const sita = await signUp()
  const gita = await signUp()
  console.log('✓ signed up host, 2 players and 1 spectator (5,000 coins each)')

  const { roomId } = await trpc<{ roomId: string }>(
    'rooms.create',
    { name: 'Smoke test', deposit: 5_000, limits: { bettingWindowSec: 10 } },
    host.token,
  )
  console.log(`✓ room ${roomId} created with 5,000 bank`)

  const hostSeat = await connect('host', host.token, roomId)
  const players = [
    await connect('ram', ram.token, roomId),
    await connect('sita', sita.token, roomId),
  ]
  const spectator = await connect('gita', gita.token, roomId)
  seats = [hostSeat, ...players, spectator]
  await waitFor('snapshots', () => seats.every((s) => s.snapshot && s.wallet >= 0))
  check(
    hostSeat.wallet === 0,
    `host wallet should be 0 after the 5,000 deposit, got ${hostSeat.wallet}`,
  )

  for (const p of players) p.room.send('join_as_player', {})
  await waitFor(
    'players',
    () =>
      Object.values(hostSeat.snapshot?.members ?? {}).filter((m) => m.role === 'PLAYER').length ===
      2,
  )
  console.log('✓ both players joined as players')

  let seq = 0
  for (let round = 1; round <= ROUNDS; round++) {
    const settledBefore = hostSeat.settled.length
    hostSeat.room.send('host_start_round', {})
    await waitFor('betting', () => hostSeat.snapshot?.phase === 'BETTING')
    const bankBefore = hostSeat.snapshot?.bankBalance ?? 0
    const walletsBefore = players.map((p) => p.wallet)

    for (const p of players) {
      const bets = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < bets; i++) {
        const symbol = SYMBOLS[Math.floor(Math.random() * 6)] as GameSymbol
        p.room.send('place_bet', { symbol, amount: [10, 50, 100][i % 3], clientSeq: ++seq })
      }
    }
    if (round === 1) {
      // Neither a spectator nor the host may bet.
      spectator.room.send('place_bet', { symbol: 'CROWN', amount: 10, clientSeq: 1 })
      hostSeat.room.send('place_bet', { symbol: 'CROWN', amount: 10, clientSeq: ++seq })
    }
    // One cancel per round to exercise refunds.
    players[1]?.room.send('cancel_bet', { symbol: 'CROWN', clientSeq: ++seq })
    await sleep(2_500)

    hostSeat.room.send('host_lock_and_roll', {})
    await waitFor(
      'settlement',
      () =>
        hostSeat.settled.length > settledBefore &&
        players.every((p) => p.settled.length > settledBefore),
    )
    await waitFor('result', () => hostSeat.snapshot?.phase === 'RESULT')
    await sleep(300)

    const result = hostSeat.settled.at(-1) as RoundSettledMessage
    check(
      verifyRoll(result.serverSeed, result.seedHash, result.roundId, result.dice).valid,
      `round ${round}: fairness proof failed`,
    )
    check(
      result.bankAfter === bankBefore + result.hostNet - result.platformFee,
      `round ${round}: bank math`,
    )
    check(hostSeat.snapshot?.bankBalance === result.bankAfter, `round ${round}: bank state`)
    players.forEach((p, i) => {
      const mine = p.settled.at(-1) as RoundSettledMessage
      check(
        p.wallet === (walletsBefore[i] ?? 0) + mine.yourNet,
        `round ${round}: ${p.name} wallet ${p.wallet} ≠ ${walletsBefore[i]} + ${mine.yourNet}`,
      )
    })
    console.log(
      `✓ round ${round}: dice ${result.dice.join(' ')} · bank ${result.bankAfter} · fee ${result.platformFee}`,
    )

    if (hostSeat.snapshot?.phase === 'PAUSED') break
    // Stop the automatic next round so the next loop starts it explicitly.
    hostSeat.room.send('host_pause', {})
    await waitFor('pause', () => hostSeat.snapshot?.phase === 'PAUSED')
  }

  check(hostSeat.errors.includes('NOT_A_PLAYER'), 'host bet should be rejected')
  check(spectator.errors.includes('NOT_A_PLAYER'), 'spectator bet should be rejected')
  check(spectator.wallet === 5_000, 'spectator wallet must be untouched')
  console.log('✓ host and spectator bets rejected')

  const bank = hostSeat.snapshot?.bankBalance ?? 0
  const hostWallet = hostSeat.wallet
  hostSeat.room.send('host_close', {})
  await waitFor('close', () => hostSeat.snapshot?.phase === 'CLOSED')
  await waitFor('bank returned', () => hostSeat.wallet === hostWallet + bank)
  console.log(`✓ room closed, ${bank} returned to host`)
  process.exit(0)
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error))
})
