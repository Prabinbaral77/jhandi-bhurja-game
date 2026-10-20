# Engineering Conventions

> How code is written in this repo. Short on purpose. If a rule blocks you, discuss and update this file — don't silently break it.

## 1. Language & tooling

- **TypeScript only**, `strict` mode, no `any`.
- **pnpm** workspaces. Node ≥ 22.
- **ESLint + Prettier** — CI fails on lint, type or format errors. No `eslint-disable` without a written reason.
- **Vitest** for tests.
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

## 2. Repo layout

```
apps/web          React + Vite + Tailwind + PixiJS
apps/api          Express + tRPC
apps/game-server  Colyseus
packages/*        shared code (game-rules, protocol, ledger, ui-theme, db)
docs/             architecture & specs
```

## 3. Layers (apps)

```
src/
├── controllers/   tRPC routers / Colyseus message handlers — request in, response out
├── services/      business logic
├── repositories/  database access only
├── schemas/       Zod schemas
├── types/         TypeScript types
├── utils/         small helpers
├── lib/           config, clients (db, redis), constants
├── components/    (web) React components
├── hooks/         (web) custom hooks
└── pages/         (web) screens / routes
```

Controller → service → repository. No skipping layers. Services never touch `req`/`res`; repositories never contain business rules.

## 4. Imports & exports

- **Web app:** absolute imports with `@/` → `src/` (e.g. `@/hooks/useGameServerPing`).
- **API, game server and packages:** absolute imports with `#` → own `src/` (Node subpath imports, `"#*": "./src/*.ts"` in `package.json`), e.g. `#services/healthService`. Reason: the web app type-checks `apps/api` source for the tRPC `AppRouter` type; a TS `@/` path would resolve to the _web_ app's `src/` there, while `#` always resolves against the owning package.
- **Between workspaces:** by package name and file, e.g. `@jhandi/game-rules/payout`.
- **No barrel files** (`index.ts` re-exports). Import the file directly.
- React components → `export default`. Everything else → named `export const`.

## 5. Validation & types

- Zod for every boundary: tRPC input/output, WebSocket messages, env vars, config, settings from DB.
- Types inferred from Zod: `type X = z.infer<typeof xSchema>`.
- Interfaces for object shapes, `type` for unions/intersections.

## 6. Money rules

- Coins are integers (`number` within safe range in TS, `bigint` column in DB). No floats; percentages in basis points.
- Only `packages/ledger` changes balances. Every movement has an idempotency key.
- Game logic (`packages/game-rules`) is pure — no I/O, no `Date.now()`, no randomness except through the RNG module.

## 7. Errors & logging

- Service layer throws `AppError(code, message, details)`; codes from [api-protocol.md](api-protocol.md) §1.1.
- One error handler per transport (tRPC error formatter, Colyseus `onError`) maps to the shared error shape.
- Structured JSON logs (pino) with `requestId`, `userId`, `roomId`, `roundId`. Never log tokens, OTPs or seeds before reveal.

## 8. Frontend

- Tailwind only for styling. Long class lists → extract to a variable.
- API data: tRPC + TanStack Query. Live room state: Zustand store fed by Colyseus.
- All user-facing text through i18n keys (Nepali default, English).

## 9. Colyseus

- The game server imports `@colyseus/core` and `@colyseus/ws-transport` directly (not the `colyseus` meta-package). Colyseus packages have circular peer dependencies; pnpm can otherwise install two copies of core and every join fails with "seat reservation expired". `assertSingleColyseusCore()` checks this at start.
- State schemas use `schema()` + `t.*` (no decorators).
- Room jobs that touch coins go through the room's serial queue (`createSerialQueue`).

## 10. Tech debt

When a quick fix is chosen over the proper one, leave:

```ts
// TODO(tech-debt): <proper fix> — deferred because <reason>. <ticket link>
```

and add it to the tracker in [progress.md](progress.md).
