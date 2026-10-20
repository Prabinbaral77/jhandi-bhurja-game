import { AppError } from '@jhandi/protocol/appError'
import { jwtVerify, SignJWT } from 'jose'
import { env } from '#lib/env'
import {
  findRefreshToken,
  insertRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
} from '#repositories/refreshTokenRepository'
import { deriveKey, hashSecret, randomToken } from '#utils/crypto'

const ACCESS_KEY = deriveKey('access-token')
const ISSUER = 'jhandi-api'
const AUDIENCE = 'jhandi-web'
// A just-rotated token arriving again within this window is a double-submit (e.g. two tabs),
// not theft, so we don't log the user out everywhere.
const REUSE_GRACE_MS = 10_000

export interface AccessToken {
  accessToken: string
  accessTokenExpiresAt: number
}

export const issueAccessToken = async (userId: string): Promise<AccessToken> => {
  const accessTokenExpiresAt = Date.now() + env.ACCESS_TOKEN_TTL_SEC * 1000
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(accessTokenExpiresAt / 1000))
    .sign(ACCESS_KEY)
  return { accessToken, accessTokenExpiresAt }
}

export const verifyAccessToken = async (token: string): Promise<string> => {
  try {
    const { payload } = await jwtVerify(token, ACCESS_KEY, { issuer: ISSUER, audience: AUDIENCE })
    if (!payload.sub) throw new Error('missing sub')
    return payload.sub
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Session expired, please sign in again')
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
