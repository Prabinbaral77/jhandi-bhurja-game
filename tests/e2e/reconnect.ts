/**
 * Reconnection test (M7): a player places a bet, their connection drops, they reconnect within
 * the 30 s window with the Colyseus reconnection token and find their bet and wallet intact.
 *
 *   pnpm --filter @jhandi/e2e reconnect
 */
import { Client, type Room } from '@colyseus/sdk'
import { myBetsMessageSchema, walletMessageSchema } from '@jhandi/protocol/room'

const API = process.env.VITE_API_URL ?? 'http://localhost:4000'
const WS = process.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}
const check = (ok: boolean, message: string) => {
  if (!ok) fail(message)
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
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } }
  return body.result ? body.result.data : fail(`${path}: ${body.error?.message ?? res.status}`)
}

const signUp = async () => {
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const { devCode = '' } = await post<{ devCode?: string }>('auth.requestOtp', {
    phone,
    ageConfirmed: true,
  })
  return (await post<{ accessToken: string }>('auth.verifyOtp', { phone, code: devCode }))
    .accessToken
}

const QUIET = [
  'bet_accepted',
  'tx_feed',
  'error',
  'round_settled',
  'chat',
  'reaction',
  'room_closed',
  'member_removed',
]
const track = (room: Room) => {
  const seen = { wallet: -1, bets: {} as Record<string, number> }
  room.onMessage('wallet', (m: unknown) => {
    seen.wallet = walletMessageSchema.parse(m).balance
  })
  room.onMessage('my_bets', (m: unknown) => {
    seen.bets = myBetsMessageSchema.parse(m).bets
  })
  for (const t of QUIET) room.onMessage(t, () => undefined)
  room.onLeave(() => undefined)
  return seen
}

const main = async () => {
  const hostToken = await signUp()
  const playerToken = await signUp()
  const { roomId } = await post<{ roomId: string }>(
    'rooms.create',
    { name: 'Reconnect', deposit: 5_000, limits: { bettingWindowSec: 60 } },
    hostToken,
  )
  const host = await new Client(WS).joinOrCreate('jhandi', {
    dbRoomId: roomId,
    accessToken: hostToken,
  })
  track(host)
  const client = new Client(WS)
  const player = await client.joinOrCreate('jhandi', { dbRoomId: roomId, accessToken: playerToken })
  const before = track(player)
  player.send('join_as_player', {})
  await sleep(1_500)
  host.send('host_start_round', {})
  await sleep(2_000)
  player.send('place_bet', { symbol: 'FLAG', amount: 200, clientSeq: 1 })
  for (let i = 0; i < 100 && before.wallet !== 5_300; i++) await sleep(100)
  check(before.wallet === 5_300, `bet should be taken (wallet ${before.wallet})`)
  console.log('✓ bet of 200 on FLAG placed')

  // Simulate a dropped connection (phone lost signal): close the socket without a consented leave.
  const token = player.reconnectionToken
  player.connection.close()
  await sleep(3_000)
  const again = await client.reconnect(token)
  const after = track(again)
  for (let i = 0; i < 100 && after.wallet < 0; i++) await sleep(100)
  check(after.wallet === 5_300, `wallet after reconnect should be 5,300, got ${after.wallet}`)
  check(after.bets.FLAG === 200, `bet should still be on FLAG, got ${JSON.stringify(after.bets)}`)
  console.log('✓ reconnected within the window: wallet and bet intact')

  // The same account from a second tab replaces the first connection.
  const second = await new Client(WS).joinOrCreate('jhandi', {
    dbRoomId: roomId,
    accessToken: playerToken,
  })
  track(second)
  await sleep(1_000)
  check(
    !again.connection.isOpen,
    'first connection should be closed when the account opens the room elsewhere',
  )
  console.log('✓ opening the room in a second tab replaced the first connection')

  host.send('host_lock_and_roll', {})
  await sleep(6_000)
  host.send('host_close', {})
  await sleep(2_000)
  process.exit(0)
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
