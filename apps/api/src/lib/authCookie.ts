import type { Request, Response } from 'express'
import { env } from '#lib/env'

const REFRESH_COOKIE = 'jb_rt'
// Only sent to the tRPC endpoint, never to static assets.
const COOKIE_PATH = '/v1/trpc'

export const readRefreshCookie = (req: Request): string | undefined => {
  // cookie-parser sets req.cookies; stay safe if the middleware is ever missing.
  const cookies = req.cookies as Record<string, unknown> | undefined
  const value = cookies?.[REFRESH_COOKIE]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const setRefreshCookie = (res: Response, token: string, maxAgeMs: number): void => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: maxAgeMs,
  })
}

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH })
}
