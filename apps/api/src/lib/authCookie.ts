import type { Request, Response } from 'express'
import { env } from '#lib/env'

// `__Secure-` prefix: browsers refuse to set it over plain http, so it can't be downgraded.
const REFRESH_COOKIE = env.NODE_ENV === 'production' ? '__Secure-jb_rt' : 'jb_rt'
// Only sent to the tRPC endpoint, never to static assets.
// Browser-visible path of the tRPC endpoint (docs/deploy.md: reverse-proxy prefix).
const COOKIE_PATH = `${env.API_PUBLIC_PREFIX}/v1/trpc`

export const readRefreshCookie = (req: Request): string | undefined => {
  // cookie-parser sets req.cookies; stay safe if the middleware is ever missing.
  const cookies = req.cookies as Record<string, unknown> | undefined
  const value = cookies?.[REFRESH_COOKIE]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const setRefreshCookie = (res: Response, token: string, maxAgeMs: number): void => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    // Secure everywhere except plain-http local development.
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: maxAgeMs,
  })
}

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH })
}
