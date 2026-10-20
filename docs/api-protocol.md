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

| Procedure                | Type     | Input                                        | Output                                               |
| ------------------------ | -------- | -------------------------------------------- | ---------------------------------------------------- |
| `health.check`           | query    | —                                            | `{ ok, db, redis, version }`                         |
| `auth.requestOtp`        | mutation | `{ phone }` (Nepal `+977` format)            | `{ expiresInSec }`                                   |
| `auth.verifyOtp`         | mutation | `{ phone, otp }`                             | `{ accessToken, user, isNewUser }`                   |
| `auth.google`            | mutation | `{ idToken }`                                | `{ accessToken, user, isNewUser }`                   |
| `auth.refresh`           | mutation | — (cookie)                                   | `{ accessToken }`                                    |
| `auth.logout`            | mutation | —                                            | `{ ok }`                                             |
| `me.get`                 | query    | —                                            | `User`                                               |
| `me.update`              | mutation | `{ displayName?, avatarUrl? }`               | `User`                                               |
| `wallet.get`             | query    | —                                            | `{ balance, dailyBonusAvailable, nextDailyBonusAt }` |
| `wallet.transactions`    | query    | cursor input                                 | page of `WalletTx`                                   |
| `wallet.claimDailyBonus` | mutation | `{ idempotencyKey }`                         | `{ amount: 10, balance }`                            |
| `rooms.create`           | mutation | `CreateRoomInput`                            | `{ roomId, inviteLink?, roomCode? }`                 |
| `rooms.listPublic`       | query    | cursor input + `{ sort?, minBet?, maxBet? }` | page of `RoomSummary`                                |
| `invite.preview`         | query    | `{ inviteToken }`                            | `RoomPreview` + `joinTicket`                         |
| `invite.joinByCode`      | mutation | `{ roomCode }`                               | `RoomPreview` + `joinTicket`                         |
| `invite.reset`           | mutation | `{ roomId }` (host)                          | `{ inviteLink, roomCode }`                           |
| `rounds.verify`          | query    | `{ roundId }`                                | `{ seedHash, serverSeed, dice, valid }`              |

Sign-up bonus (5,500) has no procedure: it is credited inside `auth.verifyOtp` / `auth.google` when `isNewUser` is true.

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

`joinTicket` is a short-lived (60 s) JWT `{ userId, roomId, access: 'INVITED' }` the game server accepts for private rooms.

---

## 3. Realtime (`apps/game-server`, Colyseus)

### 3.1 Connecting

- Lobby: join room type `lobby` (read-only) with the access token → receives `RoomSummary` diffs for public rooms.
- Game room: `joinById(roomId, { accessToken, joinTicket? })`. Users enter as **spectators**; send `join_as_player` to play.
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
