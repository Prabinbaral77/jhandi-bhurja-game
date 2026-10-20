import { roomMembers } from '@jhandi/db/schema/rooms'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { db } from '#lib/db'
import { requestOtp, verifyOtp } from '#services/authService'
import { acceptInviteLink, acceptRoomCode, resetInvite } from '#services/inviteService'
import { createRoom, listRooms } from '#services/roomService'

vi.mock('#lib/db', async () => (await import('#test/mockDb')).createMockDbModule())

let phoneCounter = 0
let ipCounter = 0
const newUser = async () => {
  const phone = `+9779811${String(100_000 + phoneCounter++).slice(-6)}`
  const ip = `10.1.0.${++ipCounter}`
  const { devCode = '' } = await requestOtp(phone, ip)
  return (await verifyOtp(phone, devCode, ip)).user.id
}

const tokenOf = (link: string) => link.split('/r/')[1] ?? ''

const newPrivateRoom = async () => {
  const hostId = await newUser()
  const created = await createRoom(hostId, {
    name: 'Family room',
    visibility: 'PRIVATE',
    venue: 'NYATAPOLA',
    deposit: 5_000,
    limits: {},
  })
  if (!created.invite) throw new Error('private room must return an invite')
  return { hostId, roomId: created.roomId, invite: created.invite }
}

describe('private rooms', () => {
  it('creates an invite with a 6-char code and a link, and hides the room from the list', async () => {
    const { roomId, invite } = await newPrivateRoom()
    expect(invite.roomCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
    expect(invite.inviteLink).toMatch(/^http:\/\/localhost:5173\/r\/[A-Za-z0-9_-]{16,}$/)
    expect((await listRooms()).some((r) => r.roomId === roomId)).toBe(false)
  })

  it('grants access by link and by code (case/space-insensitive), once per user', async () => {
    const { roomId, invite } = await newPrivateRoom()
    const ram = await newUser()
    const sita = await newUser()

    const byLink = await acceptInviteLink(tokenOf(invite.inviteLink), ram)
    expect(byLink).toMatchObject({ roomId, joined: true, members: 1, maxMembers: 20 })

    const code = ` ${invite.roomCode.toLowerCase().slice(0, 3)}-${invite.roomCode.slice(3)} `
    const byCode = await acceptRoomCode(code.toUpperCase().replace(/[\s-]/g, ''), sita, '10.2.0.1')
    expect(byCode).toMatchObject({ roomId, joined: true, members: 2 })

    // Accepting again is idempotent.
    expect((await acceptInviteLink(tokenOf(invite.inviteLink), ram)).members).toBe(2)
    const [row] = await db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, ram)))
    expect(row).toMatchObject({ access: 'INVITED', removedAt: null })
  })

  it('rejects wrong codes and rate-limits a guessing user', async () => {
    const user = await newUser()
    for (let i = 0; i < 5; i++) {
      await expect(acceptRoomCode('ABCDEF', user, '10.3.0.1')).rejects.toMatchObject({
        code: 'INVALID_CODE',
      })
    }
    await expect(acceptRoomCode('ABCDEF', user, '10.3.0.1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
  })

  it('reset makes the old link and code useless, the new ones work', async () => {
    const { hostId, roomId, invite } = await newPrivateRoom()
    const fresh = await resetInvite(roomId, hostId)
    expect(fresh.roomCode).not.toBe(invite.roomCode)

    const user = await newUser()
    await expect(acceptInviteLink(tokenOf(invite.inviteLink), user)).rejects.toMatchObject({
      code: 'INVALID_CODE',
    })
    await expect(acceptRoomCode(invite.roomCode, user, '10.4.0.1')).rejects.toMatchObject({
      code: 'INVALID_CODE',
    })
    expect((await acceptInviteLink(tokenOf(fresh.inviteLink), user)).joined).toBe(true)
  })

  it('only the host can reset; public rooms have no invite', async () => {
    const { roomId } = await newPrivateRoom()
    const stranger = await newUser()
    await expect(resetInvite(roomId, stranger)).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const host = await newUser()
    const pub = await createRoom(host, {
      name: 'Open room',
      visibility: 'PUBLIC',
      venue: 'NYATAPOLA',
      deposit: 5_000,
      limits: {},
    })
    expect(pub.invite).toBeUndefined()
    await expect(resetInvite(pub.roomId, host)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})
