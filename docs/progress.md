# Progress Tracker

> Updated after every task. Milestones are defined in [milestones.md](milestones.md).

| Milestone                          | Status                                         |
| ---------------------------------- | ---------------------------------------------- |
| M0 Project setup                   | ✅ Done (engineering), art style guide pending |
| M1 Core game rules                 | ✅ Done                                        |
| M2 Auth & wallet                   | ✅ Done                                        |
| M3 Single-room MVP                 | ✅ Done (pending review & commit)              |
| M4 Lobby & spectators              | ⏳ Next                                        |
| M5 Private rooms                   | —                                              |
| M6 Heritage art, sound & Nepali UI | —                                              |
| M7 Hardening & admin               | —                                              |
| M8 Beta & launch                   | —                                              |

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
- [x] Phone OTP sign-in with limits, sign-up bonus 5,500 in one DB transaction, Google sign-in (off until a client ID is set) — `apps/api/src/services/authService.ts`, `smsService.ts`, `repositories/{otp,user,bonus}Repository.ts` (created)
- [x] Access JWT (15 min) + rotating refresh cookie with reuse detection — `apps/api/src/services/tokenService.ts`, `repositories/refreshTokenRepository.ts`, `lib/authCookie.ts` (created)
- [x] Wallet: balance, history (cursor), daily bonus 10 once per Kathmandu day — `apps/api/src/services/walletService.ts`, `utils/nepalTime.ts` (created)
- [x] Platform settings from DB with 1-min cache — `apps/api/src/services/settingsService.ts`, `repositories/settingsRepository.ts` (created)
- [x] tRPC: `auth.*`, `me.*`, `wallet.*`; AppError → correct HTTP status; protected procedures — `apps/api/src/lib/trpc.ts`, `controllers/{auth,me,wallet,app}Router.ts` (created/modified)
- [x] Reconciliation script — `apps/api/src/scripts/reconcile.ts` (`pnpm --filter @jhandi/api reconcile`)
- [x] Web: sign-in (phone → code, dev code shown), welcome screen with 5,500 coins, home with balance + daily bonus, wallet history, NE/EN toggle, silent session refresh — `apps/web/src/{lib/{authStore,session,i18n,errors}.ts,components/*,pages/*,hooks/*,utils/format.ts}` (created/modified); M0 status page moved to `/status`
- [x] Tests on in-process Postgres (PGlite): ledger 10, API flows 13 — `apps/api/vitest.config.ts`, `apps/api/src/test/*`, `apps/api/src/services/accountFlows.test.ts`
- [x] Docs — `docs/api-protocol.md` (auth rules §2.0), `docs/database.md` (otp_codes, reconciliation)

**Exit criteria check (2026-10-20, Supabase Mumbai):**

- New user signs in → exactly 5,500 coins ✅; signing in again (and two simultaneous sign-ups) never pays twice ✅
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

## Tech debt

| Item                                                                                                                                                  | Proper fix                                                                                   | When                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| OTP is not really sent: `SMS_PROVIDER=console` shows the code in the web app (production start is blocked)                                            | Add a Nepali SMS provider (Sparrow SMS / Aakash SMS)                                         | Before beta (M8)        |
| Per-IP rate limits are in process memory                                                                                                              | Move to Redis                                                                                | M4 (when Redis arrives) |
| Google sign-in needs `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`                                                                                     | Create an OAuth client in Google Cloud                                                       | When wanted             |
| On start, a game server voids **every** unfinished round, including rounds running on another game server (seen in dev when two servers share one DB) | Track which node owns each room (Redis presence, M4) and only void rooms whose owner is gone | M4                      |
| Dev latency: each DB query Nepal → Mumbai ~100 ms, so bets take ~0.7 s and settlements 2–3 s locally                                                  | Host api/game-server in the DB region; consider a local Postgres for dev                     | M8 (hosting)            |
| Board uses emoji placeholders; dice animation is a CSS bounce                                                                                         | Heritage art + PixiJS animation                                                              | M6                      |
| Web bundle 866 kB (263 kB gzip)                                                                                                                       | Code-split routes; check what pulls in large deps                                            | M6 (performance budget) |
| `version` in health shows `0.0.0` when started with plain `node` (not via pnpm)                                                                       | Inject version at build time (tsup `define`)                                                 | M8 deploy               |

## Files touched (all milestones)

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `.env.example`, `docker-compose.yml` (deleted), `README.md`, `.github/workflows/ci.yml`
- `docs/`: `architecture.md`, `milestones.md`, `game-rules.md`, `api-protocol.md`, `database.md`, `art-direction.md`, `conventions.md`, `progress.md`
- `apps/api/`, `apps/game-server/`, `apps/web/`
- `packages/game-rules/`, `packages/protocol/`, `packages/ledger/`, `packages/db/`, `packages/ui-theme/`
