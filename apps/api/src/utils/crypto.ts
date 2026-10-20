import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { env } from '#lib/env'

// Keyed hash so a leaked table of OTP / refresh-token hashes can't be brute-forced offline.
export const hashSecret = (value: string): string =>
  createHmac('sha256', env.AUTH_SECRET).update(value).digest('hex')

export const randomToken = (): string => randomBytes(32).toString('base64url')

export const randomOtp = (): string => randomInt(0, 1_000_000).toString().padStart(6, '0')

export const safeEqualHex = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
