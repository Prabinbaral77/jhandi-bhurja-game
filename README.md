# झण्डी बुर्जा — Jhandi Burja

Real-time, multi-room Jhandi Burja for Dashain, with Nepali heritage art. Virtual coins only.

## Docs

| File                                           | What it covers                                       |
| ---------------------------------------------- | ---------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)   | System design and all product decisions (start here) |
| [docs/milestones.md](docs/milestones.md)       | Delivery plan M0–M8 with exit criteria               |
| [docs/progress.md](docs/progress.md)           | Current status and files touched per milestone       |
| [docs/game-rules.md](docs/game-rules.md)       | Exact rules: payouts, fee, exposure check, fair RNG  |
| [docs/api-protocol.md](docs/api-protocol.md)   | tRPC procedures, WebSocket messages, error codes     |
| [docs/database.md](docs/database.md)           | PostgreSQL schema                                    |
| [docs/art-direction.md](docs/art-direction.md) | Brief for artists: palette, assets, cultural rules   |
| [docs/conventions.md](docs/conventions.md)     | How code is written in this repo                     |
| [docs/security.md](docs/security.md)           | Security checklist, threat model, deploy-day steps   |
| [docs/deploy.md](docs/deploy.md)               | Hosting under prabinbaral.com.np/game: nginx, env    |

## Requirements

- Node ≥ 22.12 and pnpm 10 (`corepack enable`)
- A Supabase project (cloud Postgres, no Docker needed). Redis is optional until M4.

## Getting started

```bash
pnpm install
cp .env.example .env        # then set DATABASE_URL (Supabase session pooler)
pnpm db:migrate             # creates the `jhandi` schema and tables in Supabase
pnpm dev                    # web :5173, api :4000, game-server :2567
```

Open http://localhost:5173. Both status cards (API and Game server) should be green; Redis shows `disabled` until it is configured.

### Supabase setup

1. Create a project at supabase.com (region: Mumbai `ap-south-1` or Singapore for low latency from Nepal).
2. **Connect → Session pooler** → copy the URI into `DATABASE_URL` in `.env` and put in the database password.
3. Optional but recommended: **Project Settings → Data API** → turn the Data API off. The game connects to Postgres directly and keeps its tables in the `jhandi` schema, which the Data API does not expose.

## Scripts

| Command                                      | Does                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                   | Run web, api and game-server with hot reload                      |
| `pnpm build`                                 | Production builds of all apps                                     |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Checks run by CI                                                  |
| `pnpm format`                                | Format everything with Prettier                                   |
| `pnpm db:generate`                           | Create a migration from schema changes (`packages/db/src/schema`) |
| `pnpm db:migrate`                            | Apply migrations                                                  |

## Layout

```
apps/web          React + Vite + Tailwind (+ PixiJS from M3)
apps/api          Express + tRPC
apps/game-server  Colyseus
packages/         game-rules, protocol, ledger, db, ui-theme
docs/             design docs
```
