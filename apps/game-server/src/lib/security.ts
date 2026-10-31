import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http'
import { matchMaker, type BeforeUpgradeHandler } from '@colyseus/core'
import { env } from '#lib/env'

/**
 * Game-server hardening (docs/security.md): only the web app's origin may matchmake or open a
 * WebSocket, matchmaking is rate limited per IP, and WebSocket frames have a small size cap.
 */

const isAllowedOrigin = (origin: string | null | undefined): boolean =>
  origin === undefined || origin === null || origin === env.WEB_ORIGIN

// Matchmaking HTTP (`/matchmake/*`): Colyseus answers CORS with `*` by default.
export const restrictMatchmakerCors = (): void => {
  matchMaker.controller.getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': env.WEB_ORIGIN,
    Vary: 'Origin',
  })
}

// WebSocket upgrade: browsers always send Origin; refuse any other site. Non-browser clients
// (our e2e scripts, native apps later) send none and are checked by the access token instead.
export const refuseForeignOrigins: BeforeUpgradeHandler = (request) => {
  if (isAllowedOrigin(request.headers.get('origin'))) return undefined
  return new Response('Forbidden origin', { status: 403 })
}

// Per-IP budget for matchmaking requests (seat reservations are the expensive part).
const hits = new Map<string, { count: number; resetAt: number }>()

const clientIp = (req: IncomingMessage): string => {
  if (env.TRUST_PROXY > 0) {
    const forwarded = req.headers['x-forwarded-for']
    const chain = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    // The last TRUST_PROXY entries were appended by our own proxies; the one before is the client.
    const fromProxies = chain[chain.length - env.TRUST_PROXY]
    if (fromProxies) return fromProxies
  }
  return req.socket.remoteAddress ?? 'unknown'
}

const overBudget = (ip: string): boolean => {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 })
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }
    return false
  }
  entry.count += 1
  return entry.count > env.MATCHMAKE_RATE_LIMIT_PER_MINUTE
}

const reject = (res: ServerResponse, status: number, error: string): void => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error }))
}

/**
 * Colyseus serves `/matchmake/*` from its own listener, installed ahead of Express, so Express
 * middleware never sees those requests. Wrap every existing request listener so the origin check
 * and the per-IP budget run first. Call after `server.listen()` resolved (routes are bound then).
 */
export const guardMatchmakeRequests = (server: HttpServer): void => {
  const listeners = server.listeners('request') as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >
  server.removeAllListeners('request')
  server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/'
    if (path.startsWith('/matchmake/') && req.method !== 'OPTIONS') {
      if (!isAllowedOrigin(req.headers.origin)) {
        reject(res, 403, 'Forbidden origin')
        return
      }
      if (overBudget(clientIp(req))) {
        reject(res, 429, 'Too many requests')
        return
      }
    }
    for (const listener of listeners) listener.call(server, req, res)
  })
}

// Largest legitimate client message is a short chat line; anything bigger is abuse.
export const MAX_WS_PAYLOAD_BYTES = 16 * 1024
