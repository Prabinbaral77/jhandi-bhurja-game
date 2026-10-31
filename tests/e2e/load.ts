/**
 * Load test (M7). Opens R rooms with P players each, plays N rounds in all rooms at once and
 * reports bet acknowledgement latency (p50/p95), settlement time, errors and ledger health.
 *
 *   pnpm --filter @jhandi/e2e load [rooms] [playersPerRoom] [rounds]
 *
 * Needs the API started with OTP_IP_REQUESTS_PER_HOUR=100000 OTP_IP_VERIFIES_PER_15MIN=100000.
 * The 2,000-user / 200-room target (docs/architecture.md §8) needs servers hosted next to the DB;
 * from a laptop this measures the shape, not the ceiling.
 */
import { Client, type Room } from '@colyseus/sdk'
import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { roomSnapshotSchema, roundSettledMessageSchema } from '@jhandi/protocol/room'

const API = process.env.VITE_API_URL ?? 'http://localhost:4000'
const WS = process.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'
const ROOMS = Number(process.argv[2] ?? 10)
const PLAYERS = Number(process.argv[3] ?? 5)
const ROUNDS = Number(process.argv[4] ?? 3)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}
// Sign-ups and joins go through a small concurrency gate, like real users trickling in.
const CONCURRENCY = 4
const gate = <T>(jobs: (() => Promise<T>)[]): Promise<T[]> => {
  const results: T[] = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++
      const job = jobs[i]
      if (job) results[i] = await job()
    }
  }
  return Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => results)
}

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}

const post = async <T>(path: string, input: unknown, token?: string): Promise<T> => {
  const res = await fetch(`${API}/v1/trpc/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  })
  const text = await res.text()
  let body: { result?: { data: T }; error?: { message: string } } = {}
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    fail(`${path}: HTTP ${res.status} with non-JSON body: ${text.slice(0, 200)}`)
  }
  return body.result ? body.result.data : fail(`${path}: ${body.error?.message ?? res.status}`)
}
const signUp = async () => {
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const { devCode } = await post<{ devCode?: string }>('auth.requestOtp', {
    phone,
    ageConfirmed: true,
  })
  if (!devCode) fail(`no devCode for ${phone} (API must run with SMS_PROVIDER=console)`)
  const res = await fetch(`${API}/v1/trpc/auth.verifyOtp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, code: devCode }),
  })
  const text = await res.text()
  let body: { result?: { data: { accessToken: string } }; error?: unknown } = {}
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    fail(`verifyOtp ${phone}: HTTP ${res.status}, body: ${JSON.stringify(text.slice(0, 300))}`)
  }
  if (!body.result) fail(`verifyOtp ${phone} code=${devCode}: ${JSON.stringify(body.error)}`)
  return body.result?.data.accessToken ?? fail('no token')
}

interface Seat {
  room: Room
  phase: string
  settled: number
  pendingBets: Map<number, number>
  errors: number
  log: string[]
}
const ackLatencies: number[] = []
const settleTimes: number[] = []

const connect = async (token: string, dbRoomId: string): Promise<Seat> => {
  const room = await new Client(WS).joinOrCreate('jhandi', { dbRoomId, accessToken: token })
  const seat: Seat = { room, phase: '', settled: 0, pendingBets: new Map(), errors: 0, log: [] }
  room.onStateChange((state: { toJSON: () => unknown }) => {
    const parsed = roomSnapshotSchema.safeParse(state.toJSON())
    if (parsed.success) seat.phase = parsed.data.phase
  })
  room.onMessage('bet_accepted', (m: { clientSeq: number }) => {
    const sentAt = seat.pendingBets.get(m.clientSeq)
    if (sentAt !== undefined) {
      ackLatencies.push(Date.now() - sentAt)
      seat.pendingBets.delete(m.clientSeq)
    }
  })
  room.onMessage('error', (e: { code: string; message: string }) => {
    seat.errors += 1
    seat.log.push(`error ${e.code}: ${e.message}`)
  })
  room.onMessage('round_settled', (m: unknown) => {
    roundSettledMessageSchema.parse(m)
    seat.settled += 1
  })
  for (const t of [
    'wallet',
    'my_bets',
    'tx_feed',
    'chat',
    'reaction',
    'room_closed',
    'member_removed',
  ]) {
    room.onMessage(t, () => undefined)
  }
  room.onLeave((code: number) => {
    seat.log.push(`left ${code}`)
  })
  return seat
}

let describe: () => string = () => ''
const waitFor = async (what: string, condition: () => boolean, timeoutMs: number) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) fail(`timed out waiting for ${what}\n${describe()}`)
    await sleep(100)
  }
}

const main = async () => {
  const t0 = Date.now()
  console.log(`load: ${ROOMS} rooms × ${PLAYERS} players × ${ROUNDS} rounds`)
  // Sign-ups and room creation in parallel batches.
  const tables = await gate(
    Array.from({ length: ROOMS }, (_, i) => async () => {
      const hostToken = await signUp()
      const { roomId } = await post<{ roomId: string }>(
        'rooms.create',
        { name: `Load ${i + 1}`, deposit: 5_000, limits: { bettingWindowSec: 10 } },
        hostToken,
      )
      const host = await connect(hostToken, roomId)
      const players = await gate(
        Array.from({ length: PLAYERS }, () => async () => {
          const seat = await connect(await signUp(), roomId)
          seat.room.send('join_as_player', {})
          return seat
        }),
      )
      return { host, players }
    }),
  )
  describe = () =>
    tables
      .map(
        (t, i) =>
          `  room ${i + 1}: host phase=${t.host.phase} settled=${t.host.settled} open=${t.host.room.connection.isOpen} ${t.host.log.join('; ')}`,
      )
      .join('\n')
  console.log(
    `✓ ${ROOMS * (PLAYERS + 1)} users connected in ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  )

  let seq = 0
  for (let round = 1; round <= ROUNDS; round++) {
    for (const { host } of tables) host.room.send('host_start_round', {})
    await waitFor('betting', () => tables.every((t) => t.host.phase === 'BETTING'), 30_000)
    for (const { players } of tables) {
      for (const p of players) {
        const symbol = SYMBOLS[Math.floor(Math.random() * 6)] as GameSymbol
        const clientSeq = ++seq
        p.pendingBets.set(clientSeq, Date.now())
        p.room.send('place_bet', { symbol, amount: 50, clientSeq })
      }
    }
    await sleep(3_000)
    const settleStart = Date.now()
    for (const { host } of tables) host.room.send('host_lock_and_roll', {})
    await waitFor(
      `round ${round} settled everywhere`,
      () => tables.every((t) => t.host.settled >= round),
      90_000,
    )
    settleTimes.push(Date.now() - settleStart)
    console.log(`✓ round ${round}: all ${ROOMS} rooms settled in ${Date.now() - settleStart} ms`)
    for (const { host } of tables) host.room.send('host_pause', {})
    await waitFor('pause', () => tables.every((t) => t.host.phase === 'PAUSED'), 30_000)
  }

  const errors = tables.reduce((n, t) => n + t.players.reduce((m, p) => m + p.errors, 0), 0)
  const unacked = tables.reduce(
    (n, t) => n + t.players.reduce((m, p) => m + p.pendingBets.size, 0),
    0,
  )
  console.log('--- results ---')
  console.log(`bets acked: ${ackLatencies.length}, unacked: ${unacked}, bet errors: ${errors}`)
  console.log(
    `bet ack latency p50 ${percentile(ackLatencies, 50)} ms · p95 ${percentile(ackLatencies, 95)} ms · max ${Math.max(0, ...ackLatencies)} ms`,
  )
  console.log(
    `settlement (all rooms) p50 ${percentile(settleTimes, 50)} ms · max ${Math.max(0, ...settleTimes)} ms`,
  )
  console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  for (const { host } of tables) host.room.send('host_close', {})
  await sleep(3_000)
  process.exit(unacked === 0 ? 0 : 1)
}

main().catch((error: unknown) => {
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined
  fail(
    error instanceof Error
      ? `${error.message} ${cause ? JSON.stringify(cause) : ''}`
      : String(error),
  )
})
