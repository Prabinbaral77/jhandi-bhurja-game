# Database Schema (PostgreSQL)

> Target schema for v1. Implemented with Drizzle in `apps/api/src/db/schema/` and shared by the game server. Tables are added milestone by milestone; the column marks which milestone needs each table.

## Rules

- The DDL below is the design. The source of truth is the Drizzle schema in `packages/db/src/schema/` and the generated SQL in `packages/db/migrations/` (status/kind columns there are Postgres enums).
- System accounts and platform settings are seeded by `0002_seed_settings.sql` with fixed ids (`packages/ledger/src/systemAccounts.ts`).
- Hosted on **Supabase** Postgres. Apps connect through the **session pooler** (IPv4, supports prepared statements). If the transaction pooler (port 6543) is ever used, the client turns prepared statements off automatically.
- All tables live in the **`jhandi` schema**, not `public`, so Supabase's Data API (which exposes `public` to anyone with the anon key) can never reach game data. The DDL below omits the `jhandi.` prefix for readability.
- Connection pool is small (`DATABASE_POOL_MAX`, default 5) because Supabase pooler limits are low on small plans.
- Coins are `BIGINT`, never `NUMERIC`/float. Balances can never go below zero (`CHECK`).
- Primary keys: `uuid` (v7, time-ordered) generated in the app.
- Timestamps: `timestamptz`, stored in UTC; "today" for the daily bonus is computed in `Asia/Kathmandu`.
- Migrations are backward compatible: add nullable → backfill → make required. Never break the running app.
- Every coin movement goes through `transactions` + `ledger_entries` (double entry). No code updates `accounts.balance` outside the ledger module.

## Tables

| Table               | Milestone | Purpose                                                       |
| ------------------- | --------- | ------------------------------------------------------------- |
| `users`             | M2        | Players / hosts                                               |
| `auth_identities`   | M2        | Phone or Google identity per user                             |
| `refresh_tokens`    | M2        | Hashed refresh tokens, for logout / rotation                  |
| `otp_codes`         | M2        | Hashed one-time login codes, attempts, expiry                 |
| `accounts`          | M2        | One balance per user, room bank, round escrow, system account |
| `transactions`      | M2        | One business event (bet, settle, bonus …), idempotency key    |
| `ledger_entries`    | M2        | Debit/credit lines of a transaction                           |
| `bonuses`           | M2        | Sign-up and daily bonus claims                                |
| `platform_settings` | M2        | Admin-editable numbers                                        |
| `rooms`             | M3        | Room config and status                                        |
| `room_members`      | M3        | Who is / was in a room and with what access                   |
| `rounds`            | M3        | One shake of the dice                                         |
| `bets`              | M3        | One player's bet on one symbol in one round                   |
| `room_invites`      | M5        | Private-room link + code                                      |
| `audit_log`         | M7        | Admin and sensitive actions                                   |

## DDL

```sql
-- M2 ---------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  display_name  text NOT NULL,
  avatar_url    text,
  status        text NOT NULL DEFAULT 'ACTIVE',     -- ACTIVE | FROZEN | BANNED
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_identities (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  provider    text NOT NULL,                        -- PHONE | GOOGLE
  subject     text NOT NULL,                        -- +97798XXXXXXXX or Google sub
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE TABLE otp_codes (
  id           uuid PRIMARY KEY,
  phone        text NOT NULL,
  code_hash    text NOT NULL,        -- HMAC(AUTH_SECRET, phone + code); the code itself is never stored
  attempts     int NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON otp_codes (phone, created_at DESC);

CREATE TABLE accounts (
  id          uuid PRIMARY KEY,
  type        text NOT NULL,          -- USER | ROOM_BANK | ROUND_ESCROW | SYSTEM
  owner_id    uuid,                   -- user / room / round id; NULL for SYSTEM
  code        text,                   -- SYSTEM accounts: BONUS | PLATFORM_FEE | ADJUSTMENT
  balance     bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (type = 'SYSTEM' OR balance >= 0),   -- SYSTEM:BONUS goes negative = coins issued
  UNIQUE (type, owner_id),
  UNIQUE (code)
);

CREATE TABLE transactions (
  id               uuid PRIMARY KEY,
  kind             text NOT NULL,     -- SIGNUP_BONUS | DAILY_BONUS | HOST_DEPOSIT | BANK_TOPUP
                                       -- | BET | BET_CANCEL | SETTLE | PLATFORM_FEE | ROOM_CLOSE | ADJUSTMENT
  idempotency_key  text NOT NULL UNIQUE,
  ref_type         text,              -- ROOM | ROUND | BET
  ref_id           uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  id              bigserial PRIMARY KEY,
  transaction_id  uuid NOT NULL REFERENCES transactions(id),
  account_id      uuid NOT NULL REFERENCES accounts(id),
  amount          bigint NOT NULL,    -- + credit, − debit; entries of a transaction sum to 0
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger_entries (account_id, created_at DESC);

CREATE TABLE bonuses (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL,          -- SIGNUP | DAILY
  amount      bigint NOT NULL,
  bonus_date  date NOT NULL,          -- Asia/Kathmandu date
  claimed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON bonuses (user_id) WHERE kind = 'SIGNUP';
CREATE UNIQUE INDEX ON bonuses (user_id, bonus_date) WHERE kind = 'DAILY';

CREATE TABLE platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- seed: SIGNUP_BONUS=5500, DAILY_BONUS=10, MIN_HOST_DEPOSIT=5000,
--       MIN_HOST_BANK_TO_CONTINUE=1000, PLATFORM_FEE_BPS=200, PRIVATE_ROOM_MAX_MEMBERS=20

-- M3 ---------------------------------------------------------------
CREATE TABLE rooms (
  id               uuid PRIMARY KEY,
  host_id          uuid NOT NULL REFERENCES users(id),
  name             text NOT NULL,
  visibility       text NOT NULL,     -- PUBLIC | PRIVATE
  venue            text NOT NULL,
  config           jsonb NOT NULL,    -- limits, timings, payout table version
  status           text NOT NULL,     -- OPEN | PAUSED | CLOSED
  is_locked        boolean NOT NULL DEFAULT false,
  max_members      int,
  created_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz
);
CREATE INDEX ON rooms (status, visibility);

CREATE TABLE room_members (
  room_id     uuid NOT NULL REFERENCES rooms(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  role        text NOT NULL,          -- HOST | PLAYER | SPECTATOR
  access      text NOT NULL,          -- PUBLIC | INVITED
  joined_at   timestamptz NOT NULL DEFAULT now(),
  left_at     timestamptz,
  removed_at  timestamptz,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE rounds (
  id            uuid PRIMARY KEY,
  room_id       uuid NOT NULL REFERENCES rooms(id),
  round_no      int NOT NULL,
  status        text NOT NULL,        -- BETTING | LOCKED | SETTLED | VOIDED
  seed_hash     text NOT NULL,
  server_seed   text,                 -- written only after settlement
  dice          smallint[],           -- 6 face indexes
  losing_stakes bigint, winnings_paid bigint, platform_fee bigint,
  started_at    timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  settled_at    timestamptz,
  UNIQUE (room_id, round_no)
);

CREATE TABLE bets (
  id          uuid PRIMARY KEY,
  round_id    uuid NOT NULL REFERENCES rounds(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  symbol      text NOT NULL,
  amount      bigint NOT NULL CHECK (amount > 0),
  status      text NOT NULL,          -- PLACED | CANCELLED | WON | LOST | REFUNDED
  payout      bigint,                 -- stake returned + winnings
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id, symbol)
);
CREATE INDEX ON bets (user_id, created_at DESC);

-- M5 ---------------------------------------------------------------
CREATE TABLE room_invites (
  id          uuid PRIMARY KEY,
  room_id     uuid NOT NULL REFERENCES rooms(id),
  token_hash  text NOT NULL UNIQUE,
  code_hash   text NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
CREATE UNIQUE INDEX ON room_invites (room_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX ON room_invites (code_hash) WHERE revoked_at IS NULL;

-- M7 ---------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  target      text,
  data        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

## Reconciliation (nightly, M2)

Run with `pnpm --filter @jhandi/api reconcile` (exit code 1 on any problem). It also checks that every account's stored balance equals the sum of its ledger entries.

```sql
-- Must return 0: every transaction balances.
SELECT count(*) FROM (
  SELECT transaction_id FROM ledger_entries GROUP BY transaction_id HAVING sum(amount) <> 0
) t;

-- Must be 0: all coins issued (negative SYSTEM:BONUS) equal all coins held.
SELECT sum(balance) FROM accounts;
```
