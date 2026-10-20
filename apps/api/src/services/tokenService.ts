import { InvalidAccessTokenError, type AccessToken } from '@jhandi/auth/accessToken'
import { AppError } from '@jhandi/protocol/appError'
import { accessTokens } from '#lib/accessTokens'
import { env } from '#lib/env'
import {
  findRefreshToken,
  insertRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
} from '#repositories/refreshTokenRepository'
import { hashSecret, randomToken } from '#utils/crypto'

// A just-rotated token arriving again within this window is a double-submit (e.g. two tabs),
// not theft, so we don't log the user out everywhere.
const REUSE_GRACE_MS = 10_000

export type { AccessToken }

export const issueAccessToken = (userId: string): Promise<AccessToken> => accessTokens.issue(userId)

export const verifyAccessToken = async (token: string): Promise<string> => {
  try {
    return await accessTokens.verify(token)
  } catch (error) {
    if (error instanceof InvalidAccessTokenError) {
      throw new AppError('UNAUTHENTICATED', 'Session expired, please sign in again')
    }
    throw error
  }
}

export const issueRefreshToken = async (
  userId: string,
): Promise<{ token: string; maxAgeMs: number }> => {
  const token = randomToken()
  const maxAgeMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  await insertRefreshToken({
    userId,
    tokenHash: hashSecret(token),
    expiresAt: new Date(Date.now() + maxAgeMs),
  })
  return { token, maxAgeMs }
}

// Rotation: every refresh token works once. Replaying an old one revokes the whole family.
export const consumeRefreshToken = async (token: string): Promise<string> => {
  const row = await findRefreshToken(hashSecret(token))
  const unauthenticated = new AppError('UNAUTHENTICATED', 'Please sign in again')
  if (!row) throw unauthenticated

  if (row.revokedAt) {
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
      await revokeAllRefreshTokens(row.userId)
    }
    throw unauthenticated
  }
  if (row.expiresAt.getTime() <= Date.now()) throw unauthenticated
  if (!(await revokeRefreshToken(row.id))) throw unauthenticated
  return row.userId
}

export const revokeRefreshTokenIfValid = async (token: string): Promise<void> => {
  const row = await findRefreshToken(hashSecret(token))
  if (row && !row.revokedAt) await revokeRefreshToken(row.id)
}
