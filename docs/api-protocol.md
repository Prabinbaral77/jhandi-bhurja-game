# API & Realtime Protocol

> The contract between `apps/web`, `apps/api` and `apps/game-server`. Types live in `packages/protocol` as **Zod schemas**; TypeScript types are inferred from them (`z.infer`). Change the schema first, then the code.

---

## 1. Conventions

- **Transport:** tRPC (HTTP, batched) at `/v1/trpc`. Realtime game traffic over Colyseus WebSocket.
- **Versioning:** the `/v1` prefix. A breaking change goes to `/v2`; `/v1` keeps working until clients move.
- **Auth:** `Authorization: Bearer <accessToken>` (JWT, 15 min). Refresh token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie (30 days).
- **Validation:** every procedure input and output has a Zod schema.
- **Pagination:** every list uses cursors: input `{ cursor?: string, limit?: number }` (default 20, max 100), output `{ items, nextCursor: string | null }`.
- **Idempotency:** mutations that move coins take `idempotencyKey` (UUID from the client). Repeating a request with the same key returns the first result.
- **Rate limits:** per user and per IP (Redis). Auth and room-code endpoints have stricter limits.

### 1.1 Error shape

Every error, from tRPC or WebSocket:

```ts
{ code: ErrorCode, message: string, details?: Record<string, unknown> }
```

| Code                                                                          | Meaning                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| `UNAUTHENTICATED`                                                             | Missing / expired token                                  |
| `FORBIDDEN`                                                                   | Logged in but not allowed (e.g. not the host)            |
| `VALIDATION_FAILED`                                                           | Input failed Zod validation (`details.issues`)           |
| `NOT_FOUND`                                                                   | Room / round / invite does not exist                     |
| `RATE_LIMITED`                                                                | Too many requests (`details.retryAfterMs`)               |
| `INSUFFICIENT_BALANCE`                                                        | Wallet too low                                           |
| `BELOW_MIN_DEPOSIT`                                                           | Host deposit below `MIN_HOST_DEPOSIT`                    |
| `ALREADY_CLAIMED`                                                             | Daily bonus already claimed today                        |
| `INVALID_CODE`                                                                | Wrong or expired room code / invite link                 |
| `ROOM_LOCKED`, `ROOM_FULL`, `ROOM_CLOSED`                                     | Private-room access errors                               |
| `NOT_BETTING`, `NOT_A_PLAYER`, `BELOW_MIN`, `ABOVE_MAX`, `BANK_LIMIT_REACHED` | Bet rejections (see [game-rules.md](game-rules.md) §2.1) |
| `INTERNAL`                                                                    | Unexpected server error (logged with request ID)         |

---

## 2. tRPC procedures (`apps/api`)

| Procedure                | Type     | Input                                                               | Output                                                                                                                                                                          |
| ------------------------ | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health.check`           | query    | —                                                                   | `{ ok, service, version, dependencies: { postgres, redis: up \| down \| disabled } }`                                                                                           |
| `auth.requestOtp`        | mutation | `{ phone }` (`98XXXXXXXX`, `+977…` accepted)                        | `{ expiresInSec: 300, resendAfterSec: 60, devCode? }` — `devCode` only with `SMS_PROVIDER=console` in development                                                               |
| `auth.verifyOtp`         | mutation | `{ phone, code }` (6 digits)                                        | `{ accessToken, accessTokenExpiresAt, user, isNewUser, signupBonus }` + sets refresh cookie                                                                                     |
| `auth.config`            | query    | —                                                                   | `{ googleEnabled }`                                                                                                                                                             |
| `auth.google`            | mutation | `{ idToken }`                                                       | `{ accessToken, user, isNewUser }`                                                                                                                                              |
| `auth.refresh`           | mutation | — (cookie)                                                          | `{ accessToken }`                                                                                                                                                               |
| `auth.logout`            | mutation | — (cookie)                                                          | `{ ok }`, revokes the refresh token and clears the cookie                                                                                                                       |
| `me.get`                 | query    | —                                                                   | `User`                                                                                                                                                                          |
| `me.update`              | mutation | `{ displayName?, avatarUrl? }`                                      | `User`                                                                                                                                                                          |
| `wallet.get`             | query    | —                                                                   | `{ balance, dailyBonusAvailable, nextDailyBonusAt }`                                                                                                                            |
| `wallet.transactions`    | query    | cursor input                                                        | page of `WalletTx`                                                                                                                                                              |
| `wallet.claimDailyBonus` | mutation | — (idempotent per Kathmandu day)                                    | `{ amount: 10, balance }`; second claim → `ALREADY_CLAIMED` (409)                                                                                                               |
| `rooms.create`           | mutation | `{ name, visibility: PUBLIC \| PRIVATE, deposit ≥ 5,000, limits? }` | `{ roomId, invite?: { inviteLink, roomCode } }` — deposit moves to the room bank; one active room per host; a private room returns its invite **once** (only hashes are stored) |
| `rooms.list`             | query    | —                                                                   | open public rooms (M3: plain list, newest first; M4 adds cursor, sort, live counts)                                                                                             |
| `rooms.mine`             | query    | —                                                                   | the caller's active room as host, or `null`                                                                                                                                     |
| `invite.accept`          | mutation | `{ inviteToken }`                                                   | `InvitePreview` — opening the link grants the caller `INVITED` access (needs sign-in; the web redirects back to the link)                                                       |
| `invite.joinByCode`      | mutation | `{ roomCode }` (6 chars, case/space-insensitive)                    | `InvitePreview`; wrong code → `INVALID_CODE`; 5 wrong per user per 10 min → `RATE_LIMITED`                                                                                      |
| `invite.reset`           | mutation | `{ roomId }` (host)                                                 | `{ inviteLink, roomCode }` — old link and code stop working at once                                                                                                             |
| `rounds.verify`          | query    | `{ roundId }`                                                       | `{ seedHash, serverSeed, dice, valid }`                                                                                                                                         |

Sign-up bonus (5,500) has no procedure: it is credited inside `auth.verifyOtp` / `auth.google` when `isNewUser` is true, in the same DB transaction that creates the user.

### 2.0 Auth rules (implemented in M2)

- **OTP:** 6 digits, valid 5 min, stored only as an HMAC hash. Resend after 60 s; max 3 codes per phone per 15 min; 5 wrong attempts lock the code; a code works once. Per-IP limits: 10 code requests / hour, 30 verify attempts / 15 min.
- **Access token:** HS256 JWT, 15 min, kept in memory by the web app. Checked statelessly; account status is re-checked on refresh and on coin-moving actions.
- **Refresh token:** random 256-bit, stored hashed, `httpOnly` cookie `jb_rt` on path `/v1/trpc`, 30 days. Rotated on every refresh. Replaying an already-used token more than 10 s later revokes all of that user's refresh tokens (theft signal); within 10 s it is just rejected (two tabs racing).
- **Phone and Google accounts are separate users** in v1 (no account linking).

### 2.1 Key shapes

```ts
CreateRoomInput = {
  name: string            // 3–40 chars
  visibility: 'PUBLIC' | 'PRIVATE'
  deposit: number         // integer ≥ MIN_HOST_DEPOSIT (5,000)
  minBet?: number; maxBetPerSymbol?: number; maxBetPerPlayerPerRound?: number
  bettingWindowSec?: number
  venue?: 'NYATAPOLA' | 'KRISHNA_MANDIR' | 'BASANTAPUR' | 'CHANGU_NARAYAN' | 'SWAYAMBHU' | 'GORKHA_DURBAR'
  idempotencyKey: string
}

RoomSummary = {
  roomId, name, venue,
  host: { id, displayName, avatarUrl },
  players: number, spectators: number,
  state: RoomState, roundNo: number,
  bankBalance: number, minBet: number, maxBetPerSymbol: number,
  lastResults: Symbol[][],        // last 5 rolls
  volumeLast10Min: number,
  createdAt: string
}
```

There is no join ticket: accepting an invite records `room_members.access = 'INVITED'`, and the game server checks that row (or host) on every join to a private room (`NOT_INVITED` otherwise). Locked room → `ROOM_LOCKED`, 20 members → `ROOM_FULL`, closed → `INVALID_CODE`.

---

## 3. Realtime (`apps/game-server`, Colyseus)

### 3.1 Connecting

- Lobby: `joinOrCreate('lobby', { accessToken })` (read-only). Colyseus' LobbyRoom streams every live public room's metadata: `rooms` (full list on join), `+` (`[roomId, listing]` on change), `-` (`roomId` when a room is disposed). `listing.metadata` is a `RoomLiveSummary` (`packages/protocol/src/lobby.ts`): `dbRoomId, name, hostName, phase, roundNo, players, spectators, bankBalance, minBet, maxBetPerSymbol, lastResults (5), volumeLast10Min`. Rooms publish it at most once per second. The lobby also sends `ticker` (`TickerItem[]`: wins ≥ 200 coins across all rooms; last 20 on join, then one at a time).
- Rooms with nobody connected have no Colyseus instance and so no live summary; the web merges the API's `rooms.list` (all open rooms) with the lobby stream.
- Game room: `joinOrCreate('jhandi', { dbRoomId, accessToken })`. The room type is filtered by `dbRoomId`, so everyone with the same DB room id lands in the same Colyseus room; the first join (re)creates it from the database. Users enter as **spectators**; send `join_as_player` to play.
- Reconnect: Colyseus reconnection token, valid 30 s.

### 3.2 Synced state (Colyseus schema)

```
RoomState {
  phase: 'OPEN' | 'BETTING' | 'LOCKED' | 'ROLLING' | 'SETTLING' | 'RESULT' | 'PAUSED' | 'CLOSED'
  roundId, roundNo, seedHash, bettingEndsAt (epoch ms)
  bankBalance
  host: Member
  members: Map<userId, Member { displayName, avatarUrl, role: 'PLAYER' | 'SPECTATOR', connected }>
  board: Map<Symbol, { total, bettors }>
  myBets (sent privately, not in shared state)
  lastDice: Symbol[6] | null
  history: Symbol[][] (last 20)
}
```

### 3.3 Messages

Client → server and server → client message names and payloads are listed in [architecture.md](architecture.md) §6.1–6.2; their Zod schemas live in `packages/protocol`. Every client message carries `clientSeq` (increasing integer per connection) so the server can de-duplicate.

All server rejections use the error shape in §1.1, sent as message `error` with `{ ...error, clientSeq }`.
