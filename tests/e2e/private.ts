/**
 * Private room test (M5 exit criteria): invite link + code, outsider refused, lobby never lists
 * the room, reset kills the old link/code, lock blocks new joins, removed member cannot return.
 *
 *   pnpm --filter @jhandi/e2e private
 */
import { Client, type Room } from '@colyseus/sdk'
import { LOBBY_MESSAGES, lobbyListingSchema } from '@jhandi/protocol/lobby'
import { z } from 'zod'

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

interface Err {
  code: string
}
const trpc = async (
  path: string,
  input: unknown,
  token?: string,
): Promise<{ ok: true; data: unknown } | { ok: false; error: Err }> => {
  // Queries go over GET with the input in the URL; mutations over POST.
  const get = path.endsWith('.list')
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
  const body = (await res.json()) as {
    result?: { data: unknown }
    error?: { data?: { appError?: Err } }
  }
  if (body.result) return { ok: true, data: body.result.data }
  return { ok: false, error: body.error?.data?.appError ?? { code: 'UNKNOWN' } }
}
// Callers state the shape they expect; the API's zod output schemas guarantee it.
const must = async <T>(path: string, input: unknown, token?: string): Promise<T> => {
  const r = await trpc(path, input, token)
  return r.ok ? (r.data as T) : fail(`${path}: ${r.error.code}`)
}

const signUp = async () => {
  const phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  const { devCode = '' } = await must<{ devCode?: string }>('auth.requestOtp', {
    phone,
    ageConfirmed: true,
  })
  const s = await must<{ accessToken: string; user: { id: string } }>('auth.verifyOtp', {
    phone,
    code: devCode,
  })
  return { token: s.accessToken, id: s.user.id }
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
  'member_removed',
]
const join = async (token: string, dbRoomId: string): Promise<Room> => {
  const room = await new Client(WS).joinOrCreate('jhandi', { dbRoomId, accessToken: token })
  for (const t of ROOM_TYPES) room.onMessage(t, () => undefined)
  room.onLeave(() => undefined)
  return room
}
const joinFails = async (token: string, dbRoomId: string): Promise<string> => {
  try {
    const room = await join(token, dbRoomId)
    await room.leave()
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const main = async () => {
  const host = await signUp()
  const friend = await signUp()
  const stranger = await signUp()
  const guesser = await signUp()

  const created = await must<{ roomId: string; invite?: { inviteLink: string; roomCode: string } }>(
    'rooms.create',
    { name: 'Family', visibility: 'PRIVATE', deposit: 5_000 },
    host.token,
  )
  const invite = created.invite ?? fail('private room must return an invite')
  const token = invite.inviteLink.split('/r/')[1] ?? ''
  console.log(`✓ private room created, code ${invite.roomCode}`)

  const hostRoom = await join(host.token, created.roomId)
  check(
    (await joinFails(stranger.token, created.roomId)).includes('NOT_INVITED'),
    'stranger must be refused',
  )
  console.log('✓ host is in; stranger refused (NOT_INVITED)')

  // Lobby never lists it, and rooms.list hides it.
  const watcher = await signUp()
  const seen = new Set<string>()
  const lobby = await new Client(WS).joinOrCreate('lobby', { accessToken: watcher.token })
  lobby.onMessage(LOBBY_MESSAGES.rooms, (rooms: unknown) => {
    for (const item of z.array(z.unknown()).parse(rooms)) {
      const p = lobbyListingSchema.safeParse(item)
      if (p.success && p.data.metadata) seen.add(p.data.metadata.dbRoomId)
    }
  })
  lobby.onMessage(LOBBY_MESSAGES.added, (payload: unknown) => {
    const p = lobbyListingSchema.safeParse(z.tuple([z.string(), z.unknown()]).parse(payload)[1])
    if (p.success && p.data.metadata) seen.add(p.data.metadata.dbRoomId)
  })
  lobby.onMessage(LOBBY_MESSAGES.removed, () => undefined)
  lobby.onMessage(LOBBY_MESSAGES.ticker, () => undefined)
  lobby.onLeave(() => undefined)
  await sleep(2_500)
  check(!seen.has(created.roomId), 'private room must not appear in the lobby')
  const listed = await must<{ roomId: string }[]>('rooms.list', undefined, watcher.token)
  check(!listed.some((r) => r.roomId === created.roomId), 'private room must not be in rooms.list')
  console.log('✓ not in lobby or rooms.list')

  // Friend joins by link, enters, is removed, cannot come back.
  const preview = await must<{ joined: boolean; members: number }>(
    'invite.accept',
    { inviteToken: token },
    friend.token,
  )
  check(preview.joined && preview.members === 1, 'friend should be invited')
  const friendRoom = await join(friend.token, created.roomId)
  let leftCode = 0
  friendRoom.onLeave((code: number) => {
    leftCode = code
  })
  hostRoom.send('host_remove_member', { userId: friend.id })
  for (let i = 0; i < 100 && leftCode === 0; i++) await sleep(100)
  check(leftCode === 4103, `friend should be kicked with 4103, got ${leftCode}`)
  check(
    (await joinFails(friend.token, created.roomId)).includes('NOT_INVITED'),
    'removed friend must be refused',
  )
  console.log('✓ friend joined by link, was removed by host, cannot rejoin')

  // Wrong codes are limited; the right code works; lock blocks it.
  for (let i = 0; i < 5; i++) {
    const r = await trpc('invite.joinByCode', { roomCode: 'ABCDEF' }, guesser.token)
    check(!r.ok && r.error.code === 'INVALID_CODE', 'wrong code → INVALID_CODE')
  }
  const limited = await trpc('invite.joinByCode', { roomCode: 'ABCDEF' }, guesser.token)
  check(!limited.ok && limited.error.code === 'RATE_LIMITED', 'sixth wrong code → RATE_LIMITED')
  hostRoom.send('host_lock_room', {})
  await sleep(1_500)
  const another = await signUp()
  const locked = await trpc('invite.joinByCode', { roomCode: invite.roomCode }, another.token)
  check(
    !locked.ok && locked.error.code === 'ROOM_LOCKED',
    `locked room → ROOM_LOCKED, got ${JSON.stringify(locked)}`,
  )
  hostRoom.send('host_unlock_room', {})
  await sleep(1_500)
  const ok = await must<{ joined: boolean }>(
    'invite.joinByCode',
    { roomCode: invite.roomCode.toLowerCase() },
    another.token,
  )
  check(ok.joined, 'code should work after unlock')
  const anotherRoom = await join(another.token, created.roomId)
  console.log(
    '✓ wrong codes limited, lock/unlock respected, lowercase code accepted, member entered',
  )

  // Reset: old link/code dead, new ones alive; existing member stays.
  const fresh = await must<{ inviteLink: string; roomCode: string }>(
    'invite.reset',
    { roomId: created.roomId },
    host.token,
  )
  const late = await signUp()
  const old = await trpc('invite.accept', { inviteToken: token }, late.token)
  check(!old.ok && old.error.code === 'INVALID_CODE', 'old link dead after reset')
  const fresh2 = await must<{ joined: boolean }>(
    'invite.joinByCode',
    { roomCode: fresh.roomCode },
    late.token,
  )
  check(fresh2.joined, 'new code works')
  check(anotherRoom.connection.isOpen, 'existing member stays connected after reset')
  console.log('✓ reset: old invite dead, new one works, members kept')

  process.exit(0)
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
