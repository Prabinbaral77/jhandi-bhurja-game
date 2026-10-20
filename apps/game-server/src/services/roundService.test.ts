import { newId } from '@jhandi/db/ids'
import { bets, rooms, rounds } from '@jhandi/db/schema/rooms'
import { users } from '@jhandi/db/schema/users'
import { getOrCreateAccount } from '@jhandi/ledger/accounts'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { reconcileLedger } from '@jhandi/ledger/reconcile'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { db } from '#lib/db'
import {
  balanceOf,
  closeRoomAndReturnBank,
  createRound,
  getBankAccount,
  recordBet,
  refundBet,
  settleAndRecord,
  voidRound,
  voidUnfinishedRounds,
} from '#services/roundService'

vi.mock('#lib/db', async () => (await import('#test/mockDb')).createMockDbModule())

const newUser = async (coins: number) => {
  const id = newId()
  await db.insert(users).values({ id, displayName: `U-${id.slice(-4)}` })
  const accountId = await getOrCreateAccount(db, 'USER', id)
  await db.transaction((tx) =>
    postTransaction(tx, {
      kind: 'SIGNUP_BONUS',
      idempotencyKey: `signup:${id}`,
      entries: [
        { accountId: SYSTEM_ACCOUNT_IDS.BONUS, amount: -coins },
        { accountId, amount: coins },
      ],
    }),
  )
  return { id, accountId }
}

// A room with its host deposit already in the bank, the way the API creates it.
const newRoom = async (deposit = 5_000) => {
  const host = await newUser(deposit)
  const roomId = newId()
  await db
    .insert(rooms)
    .values({ id: roomId, hostId: host.id, name: 'Test', venue: 'X', config: {} })
  const bankAccountId = await getOrCreateAccount(db, 'ROOM_BANK', roomId)
  await db.transaction((tx) =>
    postTransaction(tx, {
      kind: 'HOST_DEPOSIT',
      idempotencyKey: `deposit:${roomId}`,
      entries: [
        { accountId: host.accountId, amount: -deposit },
        { accountId: bankAccountId, amount: deposit },
      ],
    }),
  )
  return { roomId, host, bankAccountId }
}

describe('round coin flows', () => {
  it('escrows bets, merges repeats, and refunds a cancel', async () => {
    const { roomId } = await newRoom()
    const ram = await newUser(1_000)
    const { roundId, escrowAccountId } = await createRound({ roomId, roundNo: 1, seedHash: 'h' })
    const base = { roundId, userId: ram.id, userAccountId: ram.accountId, escrowAccountId }

    await recordBet({ ...base, symbol: 'CROWN', amount: 100, idempotencyKey: 'b1' })
    await recordBet({ ...base, symbol: 'CROWN', amount: 50, idempotencyKey: 'b2' })
    expect(await recordBet({ ...base, symbol: 'CROWN', amount: 50, idempotencyKey: 'b2' })).toEqual(
      {
        duplicate: true,
      },
    )
    expect(await balanceOf(ram.accountId)).toBe(850)
    expect(await balanceOf(escrowAccountId)).toBe(150)
    const [row] = await db.select().from(bets).where(eq(bets.roundId, roundId))
    expect(row).toMatchObject({ amount: 150, status: 'PLACED' })

    await refundBet({ ...base, symbol: 'CROWN', amount: 150, idempotencyKey: 'c1' })
    expect(await balanceOf(ram.accountId)).toBe(1_000)
    expect(await balanceOf(escrowAccountId)).toBe(0)

    // Betting again on a cancelled symbol starts from the new amount.
    await recordBet({ ...base, symbol: 'CROWN', amount: 20, idempotencyKey: 'b3' })
    const [again] = await db.select().from(bets).where(eq(bets.roundId, roundId))
    expect(again).toMatchObject({ amount: 20, status: 'PLACED' })
  })

  it('settles the docs §3.2 example: winners paid, losers to bank, seed revealed', async () => {
    const { roomId, bankAccountId } = await newRoom()
    const ram = await newUser(1_000)
    const sita = await newUser(1_000)
    const hari = await newUser(1_000)
    const { roundId, escrowAccountId } = await createRound({ roomId, roundNo: 1, seedHash: 'h' })
    const place = (
      u: { id: string; accountId: string },
      symbol: 'CROWN' | 'HEART' | 'FLAG',
      amount: number,
    ) =>
      recordBet({
        roundId,
        userId: u.id,
        userAccountId: u.accountId,
        escrowAccountId,
        symbol,
        amount,
        idempotencyKey: newId(),
      })
    await place(ram, 'CROWN', 100)
    await place(sita, 'HEART', 200)
    await place(hari, 'CROWN', 50)
    await place(hari, 'FLAG', 50)

    const { result } = await settleAndRecord({
      roundId,
      serverSeed: 'a'.repeat(64),
      dice: ['CROWN', 'CROWN', 'CROWN', 'HEART', 'SPADE', 'CLUB'],
      bets: [
        { betId: '1', userId: ram.id, symbol: 'CROWN', amount: 100 },
        { betId: '2', userId: sita.id, symbol: 'HEART', amount: 200 },
        { betId: '3', userId: hari.id, symbol: 'CROWN', amount: 50 },
        { betId: '4', userId: hari.id, symbol: 'FLAG', amount: 50 },
      ],
      bankBefore: 5_000,
      feeBps: 200,
      bankAccountId,
      escrowAccountId,
      userAccounts: new Map([
        [ram.id, ram.accountId],
        [sita.id, sita.accountId],
        [hari.id, hari.accountId],
      ]),
    })

    expect(result.bankAfter).toBe(4_800)
    expect(await balanceOf(bankAccountId)).toBe(4_800)
    expect(await balanceOf(escrowAccountId)).toBe(0)
    expect(await balanceOf(ram.accountId)).toBe(1_300) // 900 + 100 back + 300
    expect(await balanceOf(sita.accountId)).toBe(800)
    expect(await balanceOf(hari.accountId)).toBe(1_100) // 900 + 50 + 150

    const betRows = await db.select().from(bets).where(eq(bets.roundId, roundId))
    const statusOf = (userId: string, symbol: string) =>
      betRows.find((b) => b.userId === userId && b.symbol === symbol)
    expect(statusOf(ram.id, 'CROWN')).toMatchObject({ status: 'WON', payout: 400 })
    expect(statusOf(sita.id, 'HEART')).toMatchObject({ status: 'LOST', payout: 0 })
    expect(statusOf(hari.id, 'FLAG')).toMatchObject({ status: 'LOST' })

    const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId))
    expect(round).toMatchObject({
      status: 'SETTLED',
      serverSeed: 'a'.repeat(64),
      dice: [0, 0, 0, 2, 3, 5],
    })
  })

  it('takes the 2 % fee when the host wins', async () => {
    const { roomId, bankAccountId } = await newRoom()
    const ram = await newUser(1_000)
    const { roundId, escrowAccountId } = await createRound({ roomId, roundNo: 1, seedHash: 'h' })
    await recordBet({
      roundId,
      userId: ram.id,
      userAccountId: ram.accountId,
      escrowAccountId,
      symbol: 'CROWN',
      amount: 1_000,
      idempotencyKey: newId(),
    })
    const feeBefore = await balanceOf(SYSTEM_ACCOUNT_IDS.PLATFORM_FEE)

    await settleAndRecord({
      roundId,
      serverSeed: 'b'.repeat(64),
      dice: ['FLAG', 'HEART', 'SPADE', 'DIAMOND', 'CLUB', 'CLUB'],
      bets: [{ betId: '1', userId: ram.id, symbol: 'CROWN', amount: 1_000 }],
      bankBefore: 5_000,
      feeBps: 200,
      bankAccountId,
      escrowAccountId,
      userAccounts: new Map([[ram.id, ram.accountId]]),
    })
    expect(await balanceOf(bankAccountId)).toBe(5_980)
    expect(await balanceOf(SYSTEM_ACCOUNT_IDS.PLATFORM_FEE)).toBe(feeBefore + 20)
  })

  it('voids an unfinished round and refunds everyone (crash recovery)', async () => {
    const { roomId } = await newRoom()
    const ram = await newUser(500)
    const { roundId, escrowAccountId } = await createRound({ roomId, roundNo: 1, seedHash: 'h' })
    await recordBet({
      roundId,
      userId: ram.id,
      userAccountId: ram.accountId,
      escrowAccountId,
      symbol: 'SPADE',
      amount: 300,
      idempotencyKey: newId(),
    })

    await voidUnfinishedRounds(() => Promise.resolve(false), roomId)
    expect(await balanceOf(ram.accountId)).toBe(500)
    expect(await balanceOf(escrowAccountId)).toBe(0)
    const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId))
    expect(round?.status).toBe('VOIDED')
    // Voiding twice is harmless.
    expect(await voidRound(roundId)).toBe(0)
  })

  it('closing a room returns the bank to the host', async () => {
    const { roomId, host } = await newRoom(6_000)
    const bankAccountId = await getBankAccount(roomId)
    const returned = await closeRoomAndReturnBank({
      roomId,
      hostAccountId: host.accountId,
      bankAccountId,
    })
    expect(returned).toBe(6_000)
    expect(await balanceOf(host.accountId)).toBe(6_000)
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
    expect(room?.status).toBe('CLOSED')
  })

  it('the ledger still reconciles', async () => {
    expect(await reconcileLedger(db)).toMatchObject({ ok: true })
  })
})
