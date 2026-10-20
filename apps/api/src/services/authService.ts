import { newId } from '@jhandi/db/ids'
import type { User } from '@jhandi/db/schema/users'
import { getOrCreateAccount } from '@jhandi/ledger/accounts'
import { UNIQUE_VIOLATION, pgErrorCode } from '@jhandi/ledger/pgError'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { AppError } from '@jhandi/protocol/appError'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { db } from '#lib/db'
import { env } from '#lib/env'
import { insertBonus } from '#repositories/bonusRepository'
import {
  consumeOtp,
  findActiveOtp,
  incrementOtpAttempts,
  insertOtp,
  listRecentOtps,
} from '#repositories/otpRepository'
import {
  findUserByIdentity,
  insertUserWithIdentity,
  type AuthProvider,
} from '#repositories/userRepository'
import { getSettings } from '#services/settingsService'
import { otpSender } from '#services/smsService'
import { hashSecret, randomOtp, safeEqualHex } from '#utils/crypto'
import { kathmanduDate } from '#utils/nepalTime'
import { createRateLimiter } from '#utils/rateLimiter'

const OTP_TTL_SEC = 300
const OTP_RESEND_AFTER_SEC = 60
const OTP_MAX_PER_WINDOW = 3
const OTP_WINDOW_MS = 15 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

const otpIpLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })
const verifyIpLimiter = createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 })

const rateLimited = (retryAfterMs: number) =>
  new AppError('RATE_LIMITED', 'Too many attempts, please wait', { retryAfterMs })

const otpHash = (phone: string, code: string) => hashSecret(`otp:${phone}:${code}`)

export const requestOtp = async (phone: string, ip: string) => {
  const ipWait = otpIpLimiter.hit(ip)
  if (ipWait > 0) throw rateLimited(ipWait)

  const now = Date.now()
  const recent = await listRecentOtps(phone, new Date(now - OTP_WINDOW_MS))
  const latest = recent[0]
  if (latest) {
    const resendAt = latest.createdAt.getTime() + OTP_RESEND_AFTER_SEC * 1000
    if (resendAt > now) throw rateLimited(resendAt - now)
  }
  const oldest = recent.at(-1)
  if (recent.length >= OTP_MAX_PER_WINDOW && oldest) {
    throw rateLimited(oldest.createdAt.getTime() + OTP_WINDOW_MS - now)
  }

  const code = randomOtp()
  await insertOtp({
    phone,
    codeHash: otpHash(phone, code),
    expiresAt: new Date(now + OTP_TTL_SEC * 1000),
  })
  const { devCode } = await otpSender.sendOtp(phone, code)
  return {
    expiresInSec: OTP_TTL_SEC,
    resendAfterSec: OTP_RESEND_AFTER_SEC,
    ...(devCode === undefined ? {} : { devCode }),
  }
}

export interface SignInResult {
  user: User
  isNewUser: boolean
  signupBonus: number
}

const defaultPhoneName = (phone: string) => `Player ${phone.slice(-4)}`

const assertActive = (user: User): void => {
  if (user.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'This account is not active')
}

// New user + wallet account + 5,500 sign-up coins, all in one DB transaction.
const signUp = async (
  provider: AuthProvider,
  subject: string,
  profile: { displayName: string; avatarUrl: string | null },
): Promise<SignInResult> => {
  const { SIGNUP_BONUS } = await getSettings()
  const user = await db.transaction(async (tx) => {
    const created = await insertUserWithIdentity(tx, {
      userId: newId(),
      identityId: newId(),
      provider,
      subject,
      ...profile,
    })
    const accountId = await getOrCreateAccount(tx, 'USER', created.id)
    if (SIGNUP_BONUS > 0) {
      await insertBonus(tx, {
        userId: created.id,
        kind: 'SIGNUP',
        amount: SIGNUP_BONUS,
        bonusDate: kathmanduDate(new Date()),
      })
      await postTransaction(tx, {
        kind: 'SIGNUP_BONUS',
        idempotencyKey: `signup:${created.id}`,
        refType: 'USER',
        refId: created.id,
        entries: [
          { accountId: SYSTEM_ACCOUNT_IDS.BONUS, amount: -SIGNUP_BONUS },
          { accountId, amount: SIGNUP_BONUS },
        ],
      })
    }
    return created
  })
  return { user, isNewUser: true, signupBonus: SIGNUP_BONUS }
}

export const signInWithIdentity = async (
  provider: AuthProvider,
  subject: string,
  profile: { displayName: string; avatarUrl: string | null },
): Promise<SignInResult> => {
  const existing = await findUserByIdentity(provider, subject)
  if (existing) {
    assertActive(existing)
    return { user: existing, isNewUser: false, signupBonus: 0 }
  }
  try {
    return await signUp(provider, subject, profile)
  } catch (error) {
    // Two sign-ins for the same new identity raced; the other one created the user.
    if (pgErrorCode(error) !== UNIQUE_VIOLATION) throw error
    const winner = await findUserByIdentity(provider, subject)
    if (!winner) throw error
    assertActive(winner)
    return { user: winner, isNewUser: false, signupBonus: 0 }
  }
}

export const verifyOtp = async (phone: string, code: string, ip: string): Promise<SignInResult> => {
  const ipWait = verifyIpLimiter.hit(ip)
  if (ipWait > 0) throw rateLimited(ipWait)

  const invalid = new AppError('INVALID_CODE', 'Wrong or expired code')
  const otp = await findActiveOtp(phone, new Date())
  if (!otp) throw invalid
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError('INVALID_CODE', 'Too many wrong attempts, request a new code')
  }
  if (!safeEqualHex(otp.codeHash, otpHash(phone, code))) {
    await incrementOtpAttempts(otp.id)
    throw invalid
  }
  if (!(await consumeOtp(otp.id))) throw invalid

  return signInWithIdentity('PHONE', phone, {
    displayName: defaultPhoneName(phone),
    avatarUrl: null,
  })
}

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  timeoutDuration: 5_000,
})

export const isGoogleEnabled = (): boolean => env.GOOGLE_CLIENT_ID !== undefined

const verifyGoogleIdToken = async (idToken: string, clientId: string): Promise<JWTPayload> => {
  try {
    const { payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    })
    return payload
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Google sign-in failed')
  }
}

export const signInWithGoogle = async (idToken: string): Promise<SignInResult> => {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError('FORBIDDEN', 'Google sign-in is not enabled')
  const payload = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID)
  if (!payload.sub) throw new AppError('UNAUTHENTICATED', 'Google sign-in failed')
  const name = typeof payload.name === 'string' && payload.name ? payload.name : 'Player'
  const picture = typeof payload.picture === 'string' ? payload.picture : null
  return signInWithIdentity('GOOGLE', payload.sub, {
    displayName: name.slice(0, 30),
    avatarUrl: picture,
  })
}
