import { newId } from '@jhandi/db/ids'
import type { Bet } from '@jhandi/game-rules/bet'
import { settleRound, type RoundSettlement } from '@jhandi/game-rules/settlement'
import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { findAccountId, getBalance, getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction, type LedgerEntryInput } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { db } from '#lib/db'
import { logger } from '#lib/logger'
import { setRoomStatus } from '#repositories/roomRepository'
import {
  applyBetResults,
  findUnfinishedRounds,
  insertRound,
  listPlacedBets,
  markBetCancelled,
  markBetsRefunded,
  markRoundSettled,
  markRoundVoided,
  upsertBet,
} from '#repositories/roundRepository'

// All coin movements of a room (docs/architecture.md §5.4). Callers serialise these per room.

export const getUserAccount = (userId: string) => getOrCreateAccount(db, 'USER', userId)

export const getBankAccount = async (roomId: string): Promise<string> => {
  const id = await findAccountId(db, 'ROOM_BANK', roomId)
  if (!id) throw new Error(`Room ${roomId} has no bank account`)
  return id
}

export const balanceOf = (accountId: string) => getBalance(db, accountId)

export const createRound = async (input: {
  roomId: string
  roundNo: number
  seedHash: string
}): Promise<{ roundId: string; escrowAccountId: string }> => {
  const roundId = newId()
  await insertRound({ id: roundId, ...input })
  const escrowAccountId = await getOrCreateAccount(db, 'ROUND_ESCROW', roundId)
  return { roundId, escrowAccountId }
}

export const recordBet = async (input: {
  roundId: string
  userId: string
  userAccountId: string
  escrowAccountId: string
  symbol: GameSymbol
  amount: number
  idempotencyKey: string
}): Promise<{ duplicate: boolean; balance?: number }> =>
  db.transaction(async (tx) => {
    const posted = await postTransaction(tx, {
      kind: 'BET',
      idempotencyKey: input.idempotencyKey,
      refType: 'ROUND',
      refId: input.roundId,
      entries: [
        { accountId: input.userAccountId, amount: -input.amount },
        { accountId: input.escrowAccountId, amount: input.amount },
      ],
    })
    if (posted.status === 'duplicate') return { duplicate: true }
    await upsertBet(tx, {
      id: newId(),
      roundId: input.roundId,
      userId: input.userId,
      symbol: input.symbol,
      amount: input.amount,
    })
    return { duplicate: false, balance: posted.balances.get(input.userAccountId) }
  })

export const refundBet = async (input: {
  roundId: string
  userId: string
  userAccountId: string
  escrowAccountId: string
  symbol: GameSymbol
  amount: number
  idempotencyKey: string
}): Promise<number | undefined> =>
  db.transaction(async (tx) => {
    const posted = await postTransaction(tx, {
      kind: 'BET_CANCEL',
      idempotencyKey: input.idempotencyKey,
      refType: 'ROUND',
      refId: input.roundId,
      entries: [
        { accountId: input.escrowAccountId, amount: -input.amount },
        { accountId: input.userAccountId, amount: input.amount },
      ],
    })
    if (posted.status === 'duplicate') return undefined
    await markBetCancelled(tx, input.roundId, input.userId, input.symbol)
    return posted.balances.get(input.userAccountId)
  })

export interface SettleInput {
  roundId: string
  serverSeed: string
  dice: GameSymbol[]
  bets: readonly Bet[]
  bankBefore: number
  feeBps: number
  bankAccountId: string
  escrowAccountId: string
  userAccounts: ReadonlyMap<string, string>
}

const settlementEntries = (input: SettleInput, result: RoundSettlement): LedgerEntryInput[] => {
  const entries: LedgerEntryInput[] = []
  for (const bet of result.bets) {
    const userAccount = input.userAccounts.get(bet.userId)
    if (!userAccount) throw new Error(`No account for bettor ${bet.userId}`)
    entries.push({ accountId: input.escrowAccountId, amount: -bet.amount })
    if (bet.won) {
      entries.push({ accountId: userAccount, amount: bet.amount + bet.winnings })
      entries.push({ accountId: input.bankAccountId, amount: -bet.winnings })
    } else {
      entries.push({ accountId: input.bankAccountId, amount: bet.amount })
    }
  }
  if (result.platformFee > 0) {
    entries.push({ accountId: input.bankAccountId, amount: -result.platformFee })
    entries.push({ accountId: SYSTEM_ACCOUNT_IDS.PLATFORM_FEE, amount: result.platformFee })
  }
  // postTransaction drops zero amounts per account, but each line must be non-zero.
  return entries.filter((e) => e.amount !== 0)
}

// One DB transaction: coins, bet results and the revealed seed are saved together or not at all.
export const settleAndRecord = async (
  input: SettleInput,
): Promise<{ result: RoundSettlement; balances: ReadonlyMap<string, number> }> => {
  const result = settleRound({
    bets: input.bets,
    dice: input.dice,
    bankBefore: input.bankBefore,
    feeBps: input.feeBps,
  })
  const entries = settlementEntries(input, result)

  const balances = await db.transaction(async (tx) => {
    let posted: Awaited<ReturnType<typeof postTransaction>> | undefined
    if (entries.length >= 2) {
      posted = await postTransaction(tx, {
        kind: 'SETTLE',
        idempotencyKey: `settle:${input.roundId}`,
        refType: 'ROUND',
        refId: input.roundId,
        entries,
      })
    }
    // Several bets of one user on one symbol were merged into one row when placed.
    await applyBetResults(
      tx,
      input.roundId,
      result.bets.map((b) => ({
        userId: b.userId,
        symbol: b.symbol,
        won: b.won,
        payout: b.stakeReturned + b.winnings,
      })),
    )
    await markRoundSettled(tx, input.roundId, {
      serverSeed: input.serverSeed,
      dice: input.dice.map((symbol) => SYMBOLS.indexOf(symbol)),
      losingStakes: result.losingStakes,
      winningsPaid: result.winningsPaid,
      platformFee: result.platformFee,
    })
    return posted?.status === 'posted' ? posted.balances : new Map<string, number>()
  })
  return { result, balances }
}

// Refund every open bet of a round that can't finish (server stopped, room disposed).
export const voidRound = async (roundId: string): Promise<number> => {
  const escrowAccountId = await findAccountId(db, 'ROUND_ESCROW', roundId)
  return db.transaction(async (tx) => {
    const placed = await listPlacedBets(tx, roundId)
    if (placed.length > 0 && escrowAccountId) {
      const entries: LedgerEntryInput[] = []
      for (const bet of placed) {
        const userAccount = await getOrCreateAccount(tx, 'USER', bet.userId)
        entries.push({ accountId: escrowAccountId, amount: -bet.amount })
        entries.push({ accountId: userAccount, amount: bet.amount })
      }
      await postTransaction(tx, {
        kind: 'BET_CANCEL',
        idempotencyKey: `void:${roundId}`,
        refType: 'ROUND',
        refId: roundId,
        entries,
      })
      await markBetsRefunded(tx, roundId)
    }
    await markRoundVoided(tx, roundId)
    return placed.length
  })
}

// Run at game-server start: any round left open by a crash is refunded.
// TODO(tech-debt): with several game-server nodes (M4) only rounds of rooms owned by dead
// nodes may be voided; today there is one node.
export const voidUnfinishedRounds = async (roomId?: string): Promise<void> => {
  for (const round of await findUnfinishedRounds(roomId)) {
    const refunded = await voidRound(round.id)
    logger.warn({ roundId: round.id, roomId: round.roomId, refunded }, 'voided unfinished round')
  }
}

export const topUpBank = async (input: {
  roomId: string
  hostAccountId: string
  bankAccountId: string
  amount: number
  idempotencyKey: string
}): Promise<ReadonlyMap<string, number>> =>
  db.transaction(async (tx) => {
    const posted = await postTransaction(tx, {
      kind: 'BANK_TOPUP',
      idempotencyKey: input.idempotencyKey,
      refType: 'ROOM',
      refId: input.roomId,
      entries: [
        { accountId: input.hostAccountId, amount: -input.amount },
        { accountId: input.bankAccountId, amount: input.amount },
      ],
    })
    return posted.status === 'posted' ? posted.balances : new Map<string, number>()
  })

// Bank goes back to the host and the room is closed for good.
export const closeRoomAndReturnBank = async (input: {
  roomId: string
  hostAccountId: string
  bankAccountId: string
}): Promise<number> => {
  const bank = await getBalance(db, input.bankAccountId)
  await db.transaction(async (tx) => {
    if (bank > 0) {
      await postTransaction(tx, {
        kind: 'ROOM_CLOSE',
        idempotencyKey: `room-close:${input.roomId}`,
        refType: 'ROOM',
        refId: input.roomId,
        entries: [
          { accountId: input.bankAccountId, amount: -bank },
          { accountId: input.hostAccountId, amount: bank },
        ],
      })
    }
  })
  await setRoomStatus(input.roomId, 'CLOSED')
  return bank
}
