# Progress Tracker

> Updated after every task. Milestones are defined in [milestones.md](milestones.md).

| Milestone                          | Status                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| M0 Project setup                   | ✅ Done (engineering), art style guide pending                     |
| M1 Core game rules                 | ✅ Done                                                            |
| M2 Auth & wallet                   | ✅ Done                                                            |
| M3 Single-room MVP                 | ✅ Done                                                            |
| M4 Lobby & spectators              | ✅ Done on one node; multi-node needs a Redis URL                  |
| M5 Private rooms                   | ✅ Done                                                            |
| M6 Heritage art, sound & Nepali UI | ✅ Done with in-house vector art                                   |
| M7 Hardening & admin               | ✅ Done except hosted monitoring/2k load (pending review & commit) |
| M8 Beta & launch                   | ⏳ Next                                                            |

## M0 — Project setup

- [x] Monorepo with pnpm workspaces — `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore` (created)
- [x] Shared TypeScript strict config — `tsconfig.base.json` (created); `tsconfig.json` in every workspace (created)
- [x] ESLint (typescript-eslint strict, type-checked) + Prettier — `eslint.config.ts`, `.prettierrc.json`, `.prettierignore` (created)
- [x] Vitest in every workspace; first tests — `packages/game-rules/src/symbols.test.ts` (created)
- [x] ~~Docker Postgres + Redis~~ → replaced by **Supabase** cloud Postgres; Redis optional (`disabled` in health) — `.env.example` (modified), `docker-compose.yml` (deleted), `packages/db/src/client.ts`, `packages/db/src/schema/jhandiSchema.ts` (created), `apps/api/src/lib/{env,db,redis}.ts`, `apps/api/src/{repositories,services}/health*.ts`, `packages/protocol/src/health.ts` (modified)
- [x] Moved Supabase project to **Mumbai (`ap-south-1`)** — warm query ~80–110 ms vs ~400 ms in Sydney; cold connect ~0.9 s vs ~4.3 s
- [x] Connected to Supabase (transaction pooler, port 6543) and ran `pnpm db:migrate` → `jhandi.platform_settings` created; API warms the DB connection at boot — `apps/api/src/server.ts`, `apps/api/src/repositories/healthRepository.ts` (modified)
- [x] Drizzle + first migration — `packages/db/drizzle.config.ts`, `packages/db/src/{client,env}.ts`, `packages/db/src/schema/platformSettings.ts`, `packages/db/migrations/0000_init.sql` (created)
- [x] Shared packages — `packages/game-rules/src/symbols.ts`, `packages/protocol/src/{errors,appError,health}.ts`, `packages/ledger/src/accounts.ts`, `packages/ui-theme/src/palette.ts` (created)
- [x] API: Express + tRPC, `health.check` pinging Postgres and Redis, shared error shape — `apps/api/src/**`, `apps/api/tsup.config.ts` (created)
- [x] Game server: Colyseus 0.18, `/health`, `ping` room with validated messages — `apps/game-server/src/**`, `apps/game-server/tsup.config.ts` (created)
- [x] Web: Vite + React 19 + Tailwind 4 + tRPC + Colyseus SDK, status page — `apps/web/**` (created)
- [x] CI: format, lint, typecheck, test, build — `.github/workflows/ci.yml` (created)
- [x] README — `README.md` (created)
- [ ] Art style guide approved (artist, see [art-direction.md](art-direction.md))

**Exit criteria check (2026-10-20, local):**

- `pnpm dev` starts web (:5173), api (:4000), game-server (:2567) — verified earlier with Docker Postgres/Redis ✅; re-verified against Supabase on 2026-10-20 ✅ (`postgres: up`, `redis: disabled`)
- `health.check` → postgres up, redis up ✅; game-server `/health` ✅; WebSocket ping/pong ~1–2 ms ✅
- format, lint, typecheck, test, build all pass locally ✅ — CI on GitHub not run yet (no remote)
- Production builds (`dist/server.js`) start and answer health checks ✅

## M1 — Core game rules

Branch: `feat/m1-game-rules`. All code in `packages/game-rules/src/` (pure functions, no I/O).

- [x] Coin amount guard — `coins.ts` (created)
- [x] Dice counts, all 462 outcomes, outcome probability — `dice.ts`, `dice.test.ts` (created)
- [x] Payout table (k ≥ 2 wins, ×k) — `payout.ts`, `payout.test.ts` (created)
- [x] Platform fee 200 bps on host profit, rounded down — `fee.ts`, `fee.test.ts` (created)
- [x] Bet schema — `bet.ts`, `bet.test.ts` (created)
- [x] Round settlement (worked example §3.2 as a test) — `settlement.ts`, `settlement.test.ts` (created)
- [x] Bank exposure over 462 outcomes, checked against brute force over 46,656 rolls — `exposure.ts`, `exposure.test.ts` (created)
- [x] Fair RNG: seed, SHA-256 commit, HMAC dice with rejection sampling, verify; works in browser — `rng.ts`, `rng.test.ts` (created); `@noble/hashes` added
- [x] Room limits & timings with platform ranges — `limits.ts`, `limits.test.ts` (created)
- [x] Bet validation in the documented order — `betValidation.ts`, `betValidation.test.ts` (created)
- [x] 100 % coverage enforced — `packages/game-rules/vitest.config.ts` (created), `packages/game-rules/package.json` (modified); `@vitest/coverage-v8` added at root
- [x] Docs: test vector §5.4, exact EV — `docs/game-rules.md`, `docs/milestones.md` (modified)

**Exit criteria check (2026-10-20):**

- 100 % statements / branches / functions / lines ✅ (55 tests)
- 1,000,000 dice within ±0.5 % of 1/6 per face ✅; player EV exactly −6469/46656 ≈ −13.87 % ✅
- Exposure never lets the bank go negative: matches brute force; `settleRound` throws if it ever would ✅

## M2 — Auth & wallet

Branch: `feat/m2-auth-wallet`.

- [x] Schema + migrations: users, auth_identities, refresh_tokens, otp_codes, accounts, transactions, ledger_entries, bonuses (`0001_auth_wallet.sql`); seed system accounts + settings (`0002_seed_settings.sql`) — `packages/db/src/schema/{users,ledger,bonuses,all}.ts`, `packages/db/src/{ids,database,testing}.ts` (created), `packages/db/src/{client.ts,schema/platformSettings.ts}` (modified)
- [x] Double-entry ledger: `postTransaction` (balanced, idempotent, row locks in id order, overdraft → `INSUFFICIENT_BALANCE`), accounts, history paging, reconciliation — `packages/ledger/src/{accounts,postTransaction,history,reconcile,pgError,systemAccounts}.ts`, `ledger.test.ts` (created/modified)
- [x] Phone OTP sign-in with limits, sign-up bonus 5,000 in one DB transaction, Google sign-in (off until a client ID is set) — `apps/api/src/services/authService.ts`, `smsService.ts`, `repositories/{otp,user,bonus}Repository.ts` (created)
- [x] Access JWT (15 min) + rotating refresh cookie with reuse detection — `apps/api/src/services/tokenService.ts`, `repositories/refreshTokenRepository.ts`, `lib/authCookie.ts` (created)
- [x] Wallet: balance, history (cursor), daily bonus 10 once per Kathmandu day — `apps/api/src/services/walletService.ts`, `utils/nepalTime.ts` (created)
- [x] Platform settings from DB with 1-min cache — `apps/api/src/services/settingsService.ts`, `repositories/settingsRepository.ts` (created)
- [x] tRPC: `auth.*`, `me.*`, `wallet.*`; AppError → correct HTTP status; protected procedures — `apps/api/src/lib/trpc.ts`, `controllers/{auth,me,wallet,app}Router.ts` (created/modified)
- [x] Reconciliation script — `apps/api/src/scripts/reconcile.ts` (`pnpm --filter @jhandi/api reconcile`)
- [x] Web: sign-in (phone → code, dev code shown), welcome screen with 5,000 coins, home with balance + daily bonus, wallet history, NE/EN toggle, silent session refresh — `apps/web/src/{lib/{authStore,session,i18n,errors}.ts,components/*,pages/*,hooks/*,utils/format.ts}` (created/modified); M0 status page moved to `/status`
- [x] Tests on in-process Postgres (PGlite): ledger 10, API flows 13 — `apps/api/vitest.config.ts`, `apps/api/src/test/*`, `apps/api/src/services/accountFlows.test.ts`
- [x] Docs — `docs/api-protocol.md` (auth rules §2.0), `docs/database.md` (otp_codes, reconciliation)

**Exit criteria check (2026-10-20, Supabase Mumbai):**

- New user signs in → exactly 5,000 coins ✅; signing in again (and two simultaneous sign-ups) never pays twice ✅
- Daily bonus once per Kathmandu day (second claim → 409 `ALREADY_CLAIMED`) ✅
- Reconciliation: `ok: true`, 0 unbalanced, total 0, 0 drifted ✅
- Refresh rotation and logout ✅
- Web screens not yet clicked through in a browser by a person ⏳

## M3 — Single-room MVP

Branch: `feat/m3-single-room`.

- [x] Schema: rooms (one active per host), room_members, rounds, bets — `packages/db/src/schema/rooms.ts`, `migrations/0003_rooms_rounds_bets.sql` (created)
- [x] Shared packages: `@jhandi/auth` (access tokens for API + game server), platform settings reader in `@jhandi/db/settings` — `packages/auth/*`, `packages/db/src/settings.ts` (created); API refactored to use them
- [x] Ledger: all balance changes of a transaction in one locked, ordered statement; new balances returned (saves a query per bet) — `packages/ledger/src/postTransaction.ts` (modified)
- [x] API: `rooms.create` (deposit ≥ 5,000 → bank), `rooms.list`, `rooms.mine` — `apps/api/src/{controllers/roomsRouter,services/roomService,repositories/roomRepository}.ts` (created)
- [x] Game server: `JhandiRoom` with OPEN → BETTING → LOCKED → ROLLING → SETTLING → RESULT → (auto next / PAUSED / CLOSED); serial job queue per room; bets/cancel in escrow; one-transaction settlement with 2 % fee; commit–reveal seed; host start / roll now / pause / top-up / close; host-away pause and auto-close after 2 min; reconnect within 30 s; chat + reactions — `apps/game-server/src/{controllers/jhandiRoom,services/roundService,repositories/*,schemas/roomState,utils/serialQueue}.ts` (created)
- [x] Crash recovery: open rounds are voided and refunded on start — `voidUnfinishedRounds`
- [x] Colyseus wiring: depend on `@colyseus/core` + `@colyseus/ws-transport` directly and fail fast if two copies of core are installed — `apps/game-server/src/utils/assertSingleColyseusCore.ts` (created)
- [x] Web: rooms list, host a room, room page (board, chips, dice, result with in-browser fairness check, host controls, members, activity, chat, reactions), NE/EN text — `apps/web/src/{pages/{Rooms,CreateRoom,Room}Page,components/room/*,hooks/useJhandiRoom,lib/roomStore}.ts(x)` (created); placeholder glyphs until M6 art
- [x] Tests: game-server coin flows on PGlite (6); end-to-end smoke (`pnpm --filter @jhandi/e2e smoke [rounds]`) and crash test (`… crash`) — `tests/e2e/*` (created)

**Exit criteria check (2026-10-20, dev machine in Nepal → Supabase Mumbai):**

- Host + players on separate connections, 10 rounds end to end with every wallet, bank, fee and fairness proof checked ✅; 50-round run also clean, ledger reconciles ✅
- Game server killed with SIGKILL mid-round → on restart the round is voided and the 300-coin bet refunded ✅
- Bet acknowledgement < 150 ms on a local network ⏳ not measurable here: from Nepal each DB query to Mumbai is ~100 ms, a bet ≈ 0.7 s and a settlement ≈ 2–3 s. Needs the servers hosted next to the DB (M8).
- Web room screens not yet clicked through in a browser by a person ⏳

## M4 — Multi-room lobby & spectators

Branch: `feat/m4-lobby`.

- [x] Room summary as Colyseus metadata (players, spectators, phase, round, bank, last 5 results, 10-min volume), published ≤ 1/s — `apps/game-server/src/controllers/jhandiRoom.ts` (modified); `.enableRealtimeListing()` on the `jhandi` handler
- [x] Lobby room: Colyseus `LobbyRoom` + sign-in + global big-win ticker (wins ≥ 200) over presence pub/sub — `apps/game-server/src/controllers/lobbyRoom.ts`, `lib/ticker.ts` (created)
- [x] Redis presence + driver when `REDIS_URL` is set (shared registry and pub/sub across nodes); in-process otherwise — `apps/game-server/src/server.ts`, `lib/env.ts` (modified); `@colyseus/redis-presence`, `@colyseus/redis-driver` added
- [x] Crash recovery now ownership-aware: on start only rounds of rooms **not** live in the shared registry are voided — `services/roundService.ts`, `lib/roomRegistry.ts` (modified/created)
- [x] Protocol: `RoomLiveSummary`, `TickerItem`, lobby message names — `packages/protocol/src/lobby.ts` (created)
- [x] Web lobby: API room list merged with live stream; sort (players / volume / newest), min-bet filter, ticker, last results per room, idle rooms marked — `apps/web/src/{hooks/useLobby.ts,components/lobby/{RoomCard,Ticker}.tsx,pages/RoomsPage.tsx}` (created/modified)
- [x] API: per-IP OTP limits configurable (`OTP_IP_REQUESTS_PER_HOUR`, `OTP_IP_VERIFIES_PER_15MIN`) so e2e tests can create many users — `apps/api/src/lib/env.ts`, `services/authService.ts` (modified)
- [x] e2e lobby test — `tests/e2e/lobby.ts` (`pnpm --filter @jhandi/e2e lobby [rooms]`)
- [ ] Two game-server nodes behind one entry point: needs a Redis URL (e.g. Upstash) and a proxy/sticky routing — not run yet

**Exit criteria check (2026-10-20, one node, dev → Supabase Mumbai):**

- 20 rooms in parallel, all listed live in the lobby ✅; spectator/player counts, phase, volume and results reach the lobby in ≤ ~1 s (the publish throttle) ✅; closed room reported ✅
- A new user opens the lobby, watches a room and joins as player without refresh ✅ (e2e; web screens not yet clicked through by a person ⏳)
- 2 nodes: ⏳ needs Redis

## M5 — Private rooms

Branch: `feat/m5-private-rooms`.

- [x] Schema: `room_invites` (hashed token + code, one active per room) — `packages/db/src/schema/invites.ts`, `migrations/0004_room_invites.sql` (created)
- [x] API: private rooms on `rooms.create` (invite returned once, `maxMembers` = 20), `invite.accept` (link), `invite.joinByCode` (per-user 5/10 min + per-IP limits), `invite.reset`; `rooms.list` hides private rooms — `apps/api/src/{services/inviteService,repositories/inviteRepository,controllers/inviteRouter}.ts` (created), `roomService.ts`, `roomsRouter.ts`, `appRouter.ts` (modified)
- [x] Game server: private rooms unlisted (never in lobby/ticker); join needs host or `INVITED` access (`NOT_INVITED`); `host_lock_room` / `host_unlock_room`; `host_remove_member` refunds open bets, revokes access, disconnects (4003) — `jhandiRoom.ts`, `repositories/roomRepository.ts`, `schemas/roomState.ts` (modified)
- [x] Protocol: `NOT_INVITED`, invite/preview schemas, 6-char code alphabet, new messages — `packages/protocol/src/{room,errors}.ts` (modified)
- [x] Web: public/private choice on create; host invite panel (code, link, copy, Web Share, reset); `/r/:inviteToken` page (sign-in redirect back); "join with code" in the lobby; lock/unlock and remove-member controls; removed/opened-elsewhere notices — `apps/web/src/{components/room/InvitePanel,components/lobby/JoinByCode,pages/InvitePage,lib/inviteStore}.tsx|ts` (created), `CreateRoomPage`, `RoomPage`, `RoomsPage`, `HostControls`, `SidePanel`, `useJhandiRoom`, `App`, `i18n` (modified)
- [x] Tests: API invite flows on PGlite (5); e2e `tests/e2e/private.ts` (`pnpm --filter @jhandi/e2e private`)

**Exit criteria check (2026-10-20):**

- Private rooms never appear in lobby, ticker or `rooms.list` ✅
- Old link/code fail right after reset; removed member cannot rejoin ✅
- Brute-force on codes blocked by rate limits (6th wrong try → `RATE_LIMITED`) ✅
- Lock → `ROOM_LOCKED` for new joins, members keep access ✅
- Web screens not yet clicked through by a person ⏳

## M6 — Heritage art, sound & Nepali UI

Branch: `feat/m6-heritage-art`. All art is original inline SVG/CSS (no image files, no artist yet — see `docs/art-direction.md` §0).

- [x] Six symbols as vector art (shirpech crown with plume, Nepal double-pennant flag, carved heart, pagoda-eave spade, Dhaka-zigzag diamond, lotus club), colour + brass-inlay variants — `apps/web/src/components/art/SymbolIcon.tsx` (created)
- [x] **3D dice throw** (requested after review): six CSS `preserve-3d` cubes with a wooden face per symbol; the brass cup rattles for 1.4 s, tips over, the dice fly out, tumble, bounce twice across the cloth (deterministic per round, so every client sees the same throw) and settle on their real faces as RESULT arrives; joining mid-round plays the throw without the shake; `prefers-reduced-motion` shows them at rest — `art/Cube.tsx`, `room/DiceArena.tsx`, `lib/dice.ts` (created), `styles.css` (modified); old `DiceRow`/`Die` removed
- [x] Khal board: Dhaka SVG pattern, brass corners, carved wooden tile frames, winning tiles glow with ×k badge — `art/Khal.tsx` (created), `room/Board.tsx` (modified)
- [x] Six venue skylines (Nyatapola, Krishna Mandir, Basantapur, Changu Narayan, Swayambhu, Gorkha Durbar) with evening sky, moon and drifting kites; host picks the venue; shown in the room header and lobby — `art/VenueBackdrop.tsx`, `lib/venues.ts` (created); `CreateRoomPage`, `RoomPage`, `RoomCard` (modified); `venue` added to protocol, API, game-server state and lobby summary
- [x] Dashain decor: marigold garland under the header — `art/Garland.tsx` (created), `Layout.tsx` (modified)
- [x] Sound: Web Audio synthesised effects (coin, cancel, dice shake, reveal, win, lose, last-3-seconds tick) with a mute toggle remembered per browser — `lib/sound.ts`, `hooks/useRoomSounds.ts`, `components/SoundToggle.tsx` (created)
- [x] Typography: Mukta (Devanagari + Latin) via Google Fonts, tabular numerals — `index.html`, `styles.css` (modified)
- [x] Brass coin chips — `room/ChipPicker.tsx` (modified)
- [x] Performance: route-level code splitting; first load now ~155 kB gzip JS + 7 kB CSS (was 266 kB in one chunk); room code loads on entering a room — `App.tsx` (modified)
- [x] Visual check: components rendered to SVG → PNG and reviewed (scratch script, not in repo)
- [x] Docs — `docs/art-direction.md` §0, `docs/architecture.md` §4 (PixiJS dropped)

**Exit criteria check (2026-10-20):**

- 60 fps on a mid-range Android: not measured on a device yet ⏳ (animations are transform/opacity only, which stays on the compositor; expected fine)
- Cultural review: no deity images anywhere; the Swayambhu stupa is drawn without the eyes; all art original ✅
- Initial download ≪ 3 MB ✅ (no image files at all)

## M7 — Hardening & admin

Branch: `feat/m7-hardening`.

- [x] Audit log table + `writeAudit` inside every admin transaction — `packages/db/src/schema/audit.ts`, `migrations/0005_audit_and_age.sql`, `apps/api/src/repositories/auditRepository.ts` (created)
- [x] Admin API (`admin.*`, DB-checked `is_admin` on every call): user search (phone/name/id) with same-IP sign-up signal, freeze/ban (logs out, blocks coin actions), coin adjustment through the ledger (idempotent), per-user ledger, rooms, platform settings edit (cache invalidated), audit list, host/player collusion report — `apps/api/src/{controllers/adminRouter,services/adminService,repositories/adminRepository}.ts` (created), `lib/trpc.ts` (`adminProcedure`), `services/settingsService.ts` (modified); `pnpm --filter @jhandi/api admin:grant <phone>` — `scripts/grantAdmin.ts` (created)
- [x] Admin web panel `/admin` (users, rooms, settings, audit, collusion) — `apps/web/src/pages/AdminPage.tsx` (created); nav link for admins
- [x] Anti-abuse: one account per phone (unique identity, since M2); sign-up IP hash → "N other accounts from this IP" on the user card; collusion report (players with ≥ 3,000 net from one host's bank in 7 days, private rooms highlighted) — `users.signup_ip_hash`
- [x] Responsible play: 18+ checkbox required at sign-in (`ageConfirmed`, stored `age_confirmed_at`); `DAILY_LOSS_CAP` (3,000/day, `0` = off) enforced per bet in the game server incl. coins at stake this round (`LOSS_CAP_REACHED`); hourly session reminder — `apps/game-server/src/controllers/jhandiRoom.ts`, `repositories/roundRepository.ts` (`netLostSince`), `utils/nepalTime.ts`, `apps/web/src/hooks/useSessionReminder.ts`, `SignInPage`, `Layout` (modified/created); `migrations/0006_seed_loss_cap.sql`
- [x] Frozen/banned users: refresh refused (`FORBIDDEN`), refresh tokens revoked, game-server join refused (status check since M3)
- [x] Reconnection e2e (drop socket, reconnect with token within 30 s: wallet and bet intact; second tab replaces first) — `tests/e2e/reconnect.ts`
- [x] Load test script with p50/p95 bet-ack latency, settlement time, error and unacked counts — `tests/e2e/load.ts`
- [x] DB robustness found by the load test: role-level `idle_in_transaction_session_timeout` / `statement_timeout` / `lock_timeout` — `migrations/0007_session_timeouts.sql`; **switched `DATABASE_URL` from the transaction pooler (6543) to the session pooler (5432)** after the transaction pooler hung game-server connections (see `docs/database.md`)
- [x] OTP per-IP limits configurable for tests (M4)
- [ ] Hosted monitoring (OpenTelemetry/Grafana, Sentry) — needs accounts/hosting; structured pino logs + `/health` + `reconcile` exit code exist
- [ ] 2,000 users / 200 rooms — needs servers next to the DB (M8 hosting)

**Exit criteria check (2026-10-20, laptop in Nepal → Supabase Mumbai, session pooler):**

- Load 10 rooms × 5 players × 3 rounds: 150 bets, 0 errors, 0 unacked; ledger reconciles ✅. Bet ack p50 3.8 s / p95 6.5 s and settlement of all 10 rooms ≈ 10 s — dominated by ~100 ms per DB round trip from Nepal and the per-room serial queue; not a server-side ceiling. Same test on a server in Mumbai is the real number (M8).
- Every admin action appears in the audit log ✅ (API tests)
- Unit tests: ledger 10, game-rules 55, game-server 6, API 22 ✅

## Security hardening (2026-10-31)

Checklist and deploy steps: `docs/security.md`.

- [x] API: `helmet` headers (HSTS in prod, nosniff, no-referrer, `X-Frame-Options: DENY`, CSP none for JSON), CORS locked to `WEB_ORIGIN`, foreign-`Origin` mutations → 403 (CSRF defence in depth), global `RATE_LIMIT_PER_MINUTE` (300) + `AUTH_RATE_LIMIT_PER_MINUTE` (30) on sign-in/refresh/invite paths, 64 KB body cap, header/request timeouts, `TRUST_PROXY` — `apps/api/src/lib/{security,env,authCookie}.ts`, `server.ts`; `security.test.ts`
- [x] Refresh cookie: `__Secure-jb_rt`, `Secure` outside development, httpOnly, SameSite=Lax, path `/v1/trpc`
- [x] Production guard rails at start: https `WEB_ORIGIN`, non-placeholder `AUTH_SECRET`, `GOOGLE_CLIENT_ID` required (console SMS refused)
- [x] Game server: matchmaking CORS + `/matchmake/*` origin check + 60/min per-IP budget via a raw HTTP listener (Colyseus serves matchmaking ahead of Express), WebSocket upgrade refused for foreign origins, 16 KB frame cap, per-connection token bucket 20/s burst 40 (kick after 50 strikes) before Zod validation — `apps/game-server/src/lib/security.ts`, `utils/onValidatedMessage.ts`, `server.ts`
- [x] Web: CSP meta in `index.html` (Vite env substitution for API/WS hosts), `public/_headers` for static hosts
- [x] Verified with curl: foreign-origin POST 403 on both servers, same-origin 200, 70 KB body 413, auth burst 429, WS upgrade with foreign Origin 403; e2e smoke passes
- [ ] `pnpm audit --prod`: `uuid` (moderate) and `elliptic` (low) remain inside `@colyseus/auth → grant`, unused at runtime

## Review changes after M6/M7 (2026-10-31)

- [x] Dice are now real 3D in WebGL (three.js, lazy chunk ~235 kB gzip): courtyard floor, lights and shadows, brass cup, six cubes with faces drawn after the hand-carved yellow Nepali dice (red/black folk figures). Deterministic mini-physics per round (`lib/dicePhysics.ts`), textures from the same SVG as the board (`lib/diceTextures.ts`), `components/room/DiceScene.tsx`
- [x] Full-screen throw sequence: cup rattles 1.4 s → dice fly/bounce 2.6 s → rest 6 s with the read-out → 3-2-1 countdown → board; "Go to board" button skips the wait; the sequence finishes even if the server already started the next round
- [x] Board: woven bamboo khal, bigger yellow tiles; after a throw, winning symbols blink green and every other symbol faint red until the host starts the next round
- [x] Host runs the table: betting has no timer; it closes when the host presses "shake the dice"; after the result the room waits (`OPEN`) for the host to start the next round. "Roll now"/"Pause" buttons removed. `resultDisplaySec` default 16 s (existing open rooms raised by `0008_result_display_16.sql`)
- [x] `ALREADY_HOSTING` error (was shown as "account not active"); `pnpm --filter @jhandi/api dev:topup <phone> [coins]` for test coins (dev only)
- [x] Side panel (people / activity / chat) moved below the board

## Tech debt

| Item                                                                                                                                                         | Proper fix                                                                                                | When                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------- |
| OTP is not really sent: `SMS_PROVIDER=console` shows the code in the web app (production start is blocked)                                                   | Add a Nepali SMS provider (Sparrow SMS / Aakash SMS)                                                      | Before beta (M8)        |
| Per-IP rate limits are in process memory (API); Colyseus-side chat limits too                                                                                | Move to Redis                                                                                             | M4 (when Redis arrives) |
| Google sign-in needs `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`                                                                                            | Create an OAuth client in Google Cloud                                                                    | When wanted             |
| Dev latency: each DB query Nepal → Mumbai ~100 ms, so bets take ~0.7 s and settlements 2–3 s locally                                                         | Host api/game-server in the DB region; consider a local Postgres for dev                                  | M8 (hosting)            |
| Multi-node not exercised: Redis driver/presence wired but unverified; production also needs sticky routing to the owning node (`@colyseus/proxy` or LB rule) | Provision Redis (Upstash, Mumbai), run 2 nodes, add proxy                                                 | M8 (hosting)            |
| No hosted monitoring (OTel/Grafana/Sentry)                                                                                                                   | Add Sentry + OTel exporter once hosting exists; alert on `reconcile` failures                             | M8                      |
| Bet latency in dev is serialised per room on a far DB (p95 6.5 s with 5 bettors)                                                                             | Host next to the DB; if still needed, batch validation and write bets without waiting for each round trip | M8, measure first       |
| No Malshree dhun / background music (needs a licensed recording)                                                                                             | License a recording, add a music toggle separate from SFX                                                 | Before launch (M8)      |
| In-house vector art is a v1 stand-in for commissioned heritage art                                                                                           | Commission an artist per `docs/art-direction.md`; swap components one by one                              | When budget allows      |
| `version` in health shows `0.0.0` when started with plain `node` (not via pnpm)                                                                              | Inject version at build time (tsup `define`)                                                              | M8 deploy               |

## Files touched (all milestones)

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `.env.example`, `docker-compose.yml` (deleted), `README.md`, `.github/workflows/ci.yml`
- `docs/`: `architecture.md`, `milestones.md`, `game-rules.md`, `api-protocol.md`, `database.md`, `art-direction.md`, `conventions.md`, `progress.md`
- `apps/api/`, `apps/game-server/`, `apps/web/`
- `packages/game-rules/`, `packages/protocol/`, `packages/ledger/`, `packages/db/`, `packages/ui-theme/`
