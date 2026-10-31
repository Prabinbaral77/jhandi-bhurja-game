# Security Checklist

> What protects the game, what is already in place, and what must be done at deploy time.
> Status as of 2026-10-31. ✅ implemented and verified · 🔧 configured at deploy · ⏳ open.

## 1. Threat model (short)

- **Coins are the asset.** Virtual only, but a cheat still ruins the game: forging bets, double payouts, reading the dice early, draining a host's bank.
- **Accounts:** stealing a session, farming sign-up bonuses, brute-forcing OTP or room codes.
- **Availability:** flooding the API or game server, oversized messages, slow clients.
- **Users' browsers:** XSS, clickjacking, cross-site requests riding on the cookie.

## 2. Game integrity (server-authoritative)

| Control                                                                                                      | Status              | Where                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------- |
| Dice, payouts and balances are computed only on the server; clients send intents                             | ✅                  | `apps/game-server`, `packages/game-rules`         |
| Commit–reveal dice: hash published before betting, seed after; anyone can verify                             | ✅                  | `game-rules/rng.ts`, "Check fairness" in the room |
| Double-entry ledger, `balance >= 0` constraint, idempotency keys on every coin move, locked rows in id order | ✅                  | `packages/ledger`                                 |
| Bet validation order (phase, role, min/max, wallet, bank exposure, daily loss cap)                           | ✅                  | `game-rules/betValidation.ts`, `jhandiRoom.ts`    |
| One writer per room (serial job queue); settlement is one DB transaction                                     | ✅                  | `jhandiRoom.ts`, `roundService.ts`                |
| Host cannot bet in their own room; private rooms need an accepted invite; member removal refunds and revokes | ✅                  | `jhandiRoom.ts`                                   |
| Nightly reconciliation (`pnpm --filter @jhandi/api reconcile`, exit 1 on mismatch)                           | ✅ / 🔧 schedule it | `packages/ledger/reconcile.ts`                    |

## 3. Authentication & sessions

| Control                                                                                                                                                                                  | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Google sign-in (ID token verified against Google's JWKS, audience = our client ID)                                                                                                       | ✅     |
| Phone OTP only as development fallback; hashed codes, 5 attempts, resend/IP limits; `SMS_PROVIDER=console` refused in production                                                         | ✅     |
| Access token: HS256 JWT, 15 min, memory only (never localStorage)                                                                                                                        | ✅     |
| Refresh token: 256-bit random, stored hashed, `httpOnly` + `Secure` + `SameSite=Lax`, path-scoped, `__Secure-` prefix in production, rotated on every use, replay → all sessions revoked | ✅     |
| 18+ confirmation required for every sign-in method                                                                                                                                       | ✅     |
| Admins: `is_admin` re-checked in the DB on every admin call; granted only by server CLI; every action audited                                                                            | ✅     |
| Frozen/banned users: refresh refused, sessions revoked, game-server join refused                                                                                                         | ✅     |
| Keys derived per purpose from one `AUTH_SECRET`; placeholder secrets refused in production                                                                                               | ✅     |

## 4. HTTP / transport hardening

| Control                                                                                                                                                                                               | Status |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| API: `helmet` headers (nosniff, no-referrer, HSTS in prod, frame-ancestors none, CSP none for JSON)                                                                                                   | ✅     |
| API: CORS restricted to `WEB_ORIGIN` with credentials                                                                                                                                                 | ✅     |
| API: CSRF defence in depth — mutations with a foreign `Origin` get 403 (on top of SameSite cookies and JSON-only bodies)                                                                              | ✅     |
| API: rate limits — `RATE_LIMIT_PER_MINUTE` (300) per IP globally, `AUTH_RATE_LIMIT_PER_MINUTE` (30) on sign-in / refresh / invite-code paths; OTP and code-guessing limits per user and IP            | ✅     |
| API: request body capped at 64 KB; header/request timeouts against slow clients                                                                                                                       | ✅     |
| Game server: matchmaking CORS restricted to `WEB_ORIGIN`; `/matchmake/*` and WebSocket upgrades from any other origin refused (raw HTTP listener, since Colyseus serves matchmaking ahead of Express) | ✅     |
| Game server: matchmaking 60/min per IP; per-connection message bucket (20/s, burst 40, flooders dropped); WebSocket frames capped at 16 KB; every message Zod-validated                               | ✅     |
| Game server: no Colyseus playground/monitor in the bundle                                                                                                                                             | ✅     |
| `TRUST_PROXY` set to the number of proxies so rate limits see real client IPs                                                                                                                         | 🔧     |
| TLS everywhere (`https://` web + API, `wss://` game server); `WEB_ORIGIN` must be https in production (enforced at start)                                                                             | 🔧     |

## 5. Browser-side (XSS, clickjacking)

| Control                                                                                                                                            | Status                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| React escapes all output; no `dangerouslySetInnerHTML` anywhere; chat is rendered as text                                                          | ✅                                                        |
| Content-Security-Policy: scripts only from self + Google Identity; connections only to our API/game server + Google; no objects, no inline scripts | ✅ (`index.html` meta)                                    |
| Static-host headers: HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy                         | 🔧 `apps/web/public/_headers` (edit the API/WS hostnames) |
| Tokens never in localStorage; only per-viewer conveniences (language, mute, host's own invite) are stored there                                    | ✅                                                        |
| Invite links/codes stored hashed; shown to the host once                                                                                           | ✅                                                        |

## 6. Data & infrastructure

| Control                                                                                                                                                           | Status            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| All tables in the `jhandi` schema, outside Supabase's public Data API; **turn the Data API off** in the Supabase project                                          | 🔧                |
| Connect through the Supabase **session pooler** only (transaction pooler hangs under load)                                                                        | ✅ docs           |
| Role-level `idle_in_transaction_session_timeout`, `statement_timeout`, `lock_timeout`                                                                             | ✅ migration 0007 |
| Secrets only in environment variables; `.env` git-ignored; `.env.example` has placeholders only                                                                   | ✅                |
| Structured logs never contain tokens, OTP codes, or seeds before reveal                                                                                           | ✅                |
| Dependency audit: `pnpm audit --prod` — remaining: `uuid` (moderate) and `elliptic` (low) inside `@colyseus/auth → grant` (OAuth helper we do not use at runtime) | ⏳ track upstream |
| Database backups (Supabase daily backups on paid plans) and point-in-time recovery                                                                                | 🔧                |

## 7. Monitoring & response

| Control                                                                                        | Status                    |
| ---------------------------------------------------------------------------------------------- | ------------------------- |
| Audit log of admin actions; collusion report; same-IP sign-up signal                           | ✅                        |
| Error tracking (Sentry) and metrics/alerts (reconcile failures, error rate, pooler saturation) | ⏳ needs hosting accounts |
| Alert on repeated `RATE_LIMITED` / 403 origin refusals from one IP                             | ⏳                        |

## 8. Deploy-day checklist

1. `NODE_ENV=production`; `WEB_ORIGIN=https://…`; `TRUST_PROXY=1` behind one load balancer.
2. Fresh `AUTH_SECRET` (`openssl rand -hex 32`); never reuse the development one.
3. `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`; add the production origin in Google Cloud → Credentials → Authorized JavaScript origins; publish the OAuth consent screen.
4. Supabase: session pooler URL, Data API off, backups on; run `pnpm db:migrate`.
5. Web: build with production `VITE_API_URL` (https) and `VITE_GAME_SERVER_URL` (wss); set the hostnames in `apps/web/public/_headers` (or the equivalent nginx/Caddy headers).
6. Schedule `reconcile` nightly; wire its exit code to an alert.
7. Load/e2e tests from one machine need raised limits: `AUTH_RATE_LIMIT_PER_MINUTE`, `OTP_IP_REQUESTS_PER_HOUR`, `OTP_IP_VERIFIES_PER_15MIN`; matchmaking is fixed at 60/min per IP.
8. Smoke test from a browser: sign in with Google, host a room, play a round, check that a foreign-origin request is refused (`curl -X POST … -H 'Origin: https://evil.example'` → 403).
