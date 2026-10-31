import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from '#lib/env'

/**
 * HTTP hardening for the JSON API (docs/security.md). The web app is a separate static site
 * with its own headers (apps/web/public/_headers); this API never serves HTML.
 */

export const securityHeaders = helmet({
  // JSON only: a strict CSP stops any accidental HTML from running scripts.
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  strictTransportSecurity:
    env.NODE_ENV === 'production' ? { maxAge: 63_072_000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'no-referrer' },
  xFrameOptions: { action: 'deny' },
})

const limiterOptions = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
}

// Everything: a per-IP budget that no honest player gets near.
export const globalRateLimit = rateLimit({
  ...limiterOptions,
  windowMs: 60_000,
  limit: env.RATE_LIMIT_PER_MINUTE,
})

// Sign-in, refresh, invite codes: credential guessing targets get a much smaller budget.
export const authRateLimit = rateLimit({
  ...limiterOptions,
  windowMs: 60_000,
  limit: env.AUTH_RATE_LIMIT_PER_MINUTE,
})

const AUTH_PATH = /^\/v1\/trpc\/(auth\.|invite\.joinByCode|invite\.accept)/

export const authPathRateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (AUTH_PATH.test(req.path)) {
    authRateLimit(req, res, next)
    return
  }
  next()
}

/**
 * CSRF defence in depth. The refresh cookie is SameSite=Lax and every mutation is a JSON POST,
 * which browsers never send cross-site with a simple form; on top of that a request that
 * carries an Origin from anywhere but our web app is refused.
 */
export const sameOriginOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  const origin = req.header('origin')
  if (origin !== undefined && origin !== env.WEB_ORIGIN) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cross-site request refused' } })
    return
  }
  next()
}

// Requests larger than this are not something the web app ever sends.
export const MAX_BODY_BYTES = 64 * 1024
