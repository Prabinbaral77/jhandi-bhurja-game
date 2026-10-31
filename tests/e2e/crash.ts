/**
 * Crash-recovery test (M3 exit criterion). Places a bet, then waits while the game server is
 * killed and restarted from outside. On restart the server must void the open round and refund
 * the escrowed coins — no coin lost or created.
 *
 *   pnpm --filter @jhandi/e2e crash   (prints CRASH_NOW when the server should be killed)
 */
import { Client } from '@colyseus/sdk'
import { walletMessageSchema } from '@jhandi/protocol/room'

const API = process.env.VITE_API_URL ?? 'http://localhost:4000'
const WS = process.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:2567'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const trpc = async <T>(path: string, input: unknown, token?: string, get = false): Promise<T> => {
  const url = get
    ? `${API}/v1/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `${API}/v1/trpc/${path}`
  const res = await fetch(url, {
    method: get ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(get ? {} : { body: JSON.stringify(input) }),
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

const main = async () => {
  const hostToken = await signUp()
  const playerToken = await signUp()
  const { roomId } = await trpc<{ roomId: string }>(
    'rooms.create',
    { name: 'Crash test', deposit: 5_000, limits: { bettingWindowSec: 60 } },
    hostToken,
  )

  const host = await new Client(WS).joinOrCreate('jhandi', {
    dbRoomId: roomId,
    accessToken: hostToken,
  })
  const player = await new Client(WS).joinOrCreate('jhandi', {
    dbRoomId: roomId,
    accessToken: playerToken,
  })
  let wallet = -1
  player.onMessage('wallet', (m: unknown) => {
    wallet = walletMessageSchema.parse(m).balance
  })
  for (const room of [host, player]) {
    for (const t of [
      'my_bets',
      'bet_accepted',
      'tx_feed',
      'error',
      'round_settled',
      'room_closed',
    ]) {
      room.onMessage(t, () => undefined)
    }
    room.onLeave(() => undefined)
  }

  player.send('join_as_player', {})
  await sleep(1_500)
  host.send('host_start_round', {})
  await sleep(2_500)
  player.send('place_bet', { symbol: 'CROWN', amount: 300, clientSeq: 1 })
  for (let i = 0; i < 100 && wallet !== 4_700; i++) await sleep(100)
  if (wallet !== 4_700) fail(`bet not taken (wallet ${wallet})`)
  console.log('✓ 300 coins are in escrow (wallet 4,700)')

  console.log('CRASH_NOW')
  // The server is killed and restarted now; on boot it must refund the open round.
  for (let i = 0; i < 120; i++) {
    await sleep(1_000)
    const { balance } = await trpc<{ balance: number }>('wallet.get', {}, playerToken, true)
    if (balance === 5_000) {
      console.log('✓ after restart the round was voided and 300 coins refunded (wallet 5,000)')
      process.exit(0)
    }
  }
  fail('coins were not refunded after restart')
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
