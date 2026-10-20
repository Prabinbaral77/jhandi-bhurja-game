import { jwtVerify, SignJWT } from 'jose'
import { createHmac } from 'node:crypto'

// Shared by the API (issues) and the game server (verifies) so both agree on the format.
const ISSUER = 'jhandi-api'
const AUDIENCE = 'jhandi-web'

export interface AccessToken {
  accessToken: string
  accessTokenExpiresAt: number
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Invalid or expired access token')
    this.name = 'InvalidAccessTokenError'
  }
}

// Separate keys per purpose, derived from the one AUTH_SECRET.
export const deriveKey = (secret: string, purpose: string): Uint8Array =>
  new Uint8Array(createHmac('sha256', secret).update(`key:${purpose}`).digest())

export const createAccessTokens = (secret: string, ttlSec: number) => {
  const key = deriveKey(secret, 'access-token')

  const issue = async (userId: string): Promise<AccessToken> => {
    const accessTokenExpiresAt = Date.now() + ttlSec * 1000
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(accessTokenExpiresAt / 1000))
      .sign(key)
    return { accessToken, accessTokenExpiresAt }
  }

  // Returns the user id.
  const verify = async (token: string): Promise<string> => {
    try {
      const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE })
      if (!payload.sub) throw new Error('missing sub')
      return payload.sub
    } catch {
      throw new InvalidAccessTokenError()
    }
  }

  return { issue, verify }
}
