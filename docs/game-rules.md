# Game Rules — Implementation Spec

> The exact rules `packages/game-rules` must implement (Milestone M1). [architecture.md](architecture.md) §2 explains _why_; this file says _exactly how_. If the two disagree, fix one of them before writing code.

All coin amounts are **integers**. No floating-point math anywhere in coin calculations.

---

## 1. Symbols & dice faces

| Face index | Code      | Nepali |
| ---------- | --------- | ------ |
| 0          | `CROWN`   | बुर्जा |
| 1          | `FLAG`    | झण्डा  |
| 2          | `HEART`   | पान    |
| 3          | `SPADE`   | सुरत   |
| 4          | `DIAMOND` | ईंट्टा |
| 5          | `CLUB`    | चिडी   |

- Every die has all six faces. A roll is an array of **6** face indexes.
- `counts[s]` = how many of the 6 dice show symbol `s`. `Σ counts = 6`.
- The face-index order above is part of the fairness proof. **Never reorder it.**

---

## 2. Bets

- A bet is `{ userId, symbol, amount }`. A player may bet on several symbols in one round.
- Bets on the same symbol by the same player in one round are **merged** (amounts add up).
- Cancel removes the player's whole bet on that symbol; allowed only while the round is `BETTING`.
- **The host cannot bet in their own room.**

### 2.1 Limits

| Limit                          | Default | Who sets it                            |
| ------------------------------ | ------- | -------------------------------------- |
| `minBet`                       | 10      | Host, within platform range 10–1,000   |
| `maxBetPerSymbol` (per player) | 1,000   | Host, within platform range 100–10,000 |
| `maxBetPerPlayerPerRound`      | 3,000   | Host, within platform range 100–30,000 |
| Bank solvency                  | §4      | Server, always                         |

Validation order (first failure wins, returns that error code):

1. Round state is `BETTING` → else `NOT_BETTING`
2. User is a player in the room and not the host → else `NOT_A_PLAYER`
3. `amount` is an integer ≥ `minBet` → else `BELOW_MIN`
4. Player's total on this symbol ≤ `maxBetPerSymbol` and round total ≤ `maxBetPerPlayerPerRound` → else `ABOVE_MAX`
5. Player wallet balance ≥ `amount` → else `INSUFFICIENT_BALANCE`
6. Exposure check passes (§4) → else `BANK_LIMIT_REACHED`

---

## 3. Payout

Payout table (v1, all rooms):

| `k` = matches | Multiplier `m(k)` | Player receives      |
| ------------- | ----------------- | -------------------- |
| 0             | —                 | nothing (stake lost) |
| 1             | —                 | nothing (stake lost) |
| 2             | 2                 | stake + 2 × stake    |
| 3             | 3                 | stake + 3 × stake    |
| 4             | 4                 | stake + 4 × stake    |
| 5             | 5                 | stake + 5 × stake    |
| 6             | 6                 | stake + 6 × stake    |

For a bet of `b` on symbol `s` with `k = counts[s]`:

```
if k >= 2: stakeReturned = b; winnings = m(k) * b
else:      stakeReturned = 0; lostStake = b
```

### 3.1 Round settlement

```
losingStakes   = Σ b  over bets with k < 2
winningsPaid   = Σ m(k)·b over bets with k ≥ 2
hostNet        = losingStakes − winningsPaid            // can be negative
platformFee    = hostNet > 0 ? floor(hostNet · PLATFORM_FEE_BPS / 10_000) : 0
bankAfter      = bankBefore + hostNet − platformFee
```

Ledger movements are listed in architecture §5.4. Settlement output must contain, per bet: `stakeReturned`, `winnings`, `lostStake`; and for the round: `losingStakes`, `winningsPaid`, `hostNet`, `platformFee`, `bankAfter`.

### 3.2 Example

Bank 5,000. Bets: Ram 100 on `CROWN`, Sita 200 on `HEART`, Hari 50 on `CROWN` and 50 on `FLAG`.
Dice: `CROWN, CROWN, CROWN, HEART, SPADE, CLUB` → counts `CROWN=3, HEART=1, SPADE=1, CLUB=1`.

| Bet            | k   | Result              |
| -------------- | --- | ------------------- |
| Ram 100 CROWN  | 3   | gets 100 back + 300 |
| Hari 50 CROWN  | 3   | gets 50 back + 150  |
| Sita 200 HEART | 1   | loses 200           |
| Hari 50 FLAG   | 0   | loses 50            |

`losingStakes = 250`, `winningsPaid = 450`, `hostNet = −200`, `platformFee = 0`, `bankAfter = 4,800`.

This example must be a unit test.

---

## 4. Bank solvency (exposure check)

Before accepting a bet, the server builds the round's bets **including the new bet** and computes:

```
for every possible counts vector c (all 462 ways to put 6 dice into 6 symbols):
    hostNet(c) = Σ over bets: (k < 2 ? +b : −m(k)·b)   where k = c[symbol]
worstCase = min over c of hostNet(c)
accept only if bankBefore + worstCase >= 0
```

Notes:

- Only per-symbol totals matter, so first sum all bets by symbol (6 numbers), then loop the 462 vectors. Precompute the 462 vectors once at module load.
- Losing stakes from the same round may offset winnings, because settlement is one atomic transaction (escrow → bank happens before bank → winners).
- Cancelling a bet never needs a check (it can only lower exposure).

---

## 5. Fair RNG (commit–reveal)

### 5.1 Commit (round start)

```
serverSeed = 32 random bytes from crypto.randomBytes
seedHash   = hex(SHA-256(serverSeed))
```

`seedHash` is sent to every client in `round_started`. `serverSeed` stays secret until the round is settled.

### 5.2 Roll (after betting locks)

For die `i` in `0..5`:

```
for attempt j = 0, 1, 2, ...:
    h = HMAC-SHA256(key = serverSeed, message = `${roundId}:${i}:${j}`)
    for each byte x of h (in order):
        if x < 252: face[i] = x mod 6; stop      // 252 = 6 × 42, removes modulo bias
```

(The chance that all 32 bytes are ≥ 252 is about 10⁻⁵⁸, so `j > 0` practically never happens, but must be implemented.)

### 5.3 Reveal & verify

- After settlement, `serverSeed` is sent in `round_settled` and stored in `rounds.server_seed`.
- `verify(serverSeed, seedHash, roundId)` returns `{ valid: boolean, dice }`. It must be the exact same function the server uses to roll, exported for the web client.

---

## 6. Timing (defaults, room-configurable within limits)

| Phase                            | Default | Range   |
| -------------------------------- | ------- | ------- |
| Betting window                   | 20 s    | 10–60 s |
| Roll animation (`ROLLING`)       | 3 s     | fixed   |
| Result display before next round | 5 s     | 3–15 s  |

Server timers are the source of truth. Clients receive absolute timestamps (`bettingEndsAt`) and show countdowns from them.

---

## 7. Required tests (M1 exit criteria)

- Payout table for every `k` (0–6).
- Example §3.2 exactly.
- Fee: rounding down, zero when `hostNet ≤ 0`.
- 462 outcome vectors generated, all unique, each sums to 6.
- Exposure: accepts a bet exactly at the limit, rejects one coin over.
- RNG: same seed + roundId → same dice; verify detects a wrong seed; distribution test over 1,000,000 rolls within ±0.5 % of 1/6 per face.
- Simulation: player EV ≈ −13.9 % (±0.3 %).
