# Progress Tracker

> Updated after every task. Milestones are defined in [milestones.md](milestones.md).

| Milestone                          | Status                                         |
| ---------------------------------- | ---------------------------------------------- |
| M0 Project setup                   | ✅ Done (engineering), art style guide pending |
| M1 Core game rules                 | ⏳ Next                                        |
| M2 Auth & wallet                   | —                                              |
| M3 Single-room MVP                 | —                                              |
| M4 Lobby & spectators              | —                                              |
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

## Tech debt

| Item                                                                            | Proper fix                                        | When                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------- |
| Web bundle 737 kB (225 kB gzip) on a status page                                | Code-split routes; check what pulls in large deps | M6 (performance budget) |
| `version` in health shows `0.0.0` when started with plain `node` (not via pnpm) | Inject version at build time (tsup `define`)      | M8 deploy               |

## Files touched (all milestones)

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc`, `.env.example`, `docker-compose.yml` (deleted), `README.md`, `.github/workflows/ci.yml`
- `docs/`: `architecture.md`, `milestones.md`, `game-rules.md`, `api-protocol.md`, `database.md`, `art-direction.md`, `conventions.md`, `progress.md`
- `apps/api/`, `apps/game-server/`, `apps/web/`
- `packages/game-rules/`, `packages/protocol/`, `packages/ledger/`, `packages/db/`, `packages/ui-theme/`
