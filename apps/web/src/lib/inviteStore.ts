import type { Invite } from '@jhandi/protocol/room'

// The server keeps only hashes, so the host's own link and code live in this browser.
// Lost (other device, cleared storage) → the host resets the invite to get new ones.
const key = (roomId: string) => `invite:${roomId}`

export const rememberInvite = (roomId: string, invite: Invite): void => {
  try {
    localStorage.setItem(key(roomId), JSON.stringify(invite))
  } catch {
    // Private mode: the host can still reset to see a fresh invite.
  }
}

export const recallInvite = (roomId: string): Invite | null => {
  try {
    const raw = localStorage.getItem(key(roomId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'inviteLink' in parsed &&
      'roomCode' in parsed &&
      typeof parsed.inviteLink === 'string' &&
      typeof parsed.roomCode === 'string'
    ) {
      return { inviteLink: parsed.inviteLink, roomCode: parsed.roomCode }
    }
    return null
  } catch {
    return null
  }
}
