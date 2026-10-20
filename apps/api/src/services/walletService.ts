import { findAccountId, getBalance, getOrCreateAccount } from '@jhandi/ledger/accounts'
import { getAccountHistory } from '@jhandi/ledger/history'
import { postTransaction } from '@jhandi/ledger/postTransaction'
import { SYSTEM_ACCOUNT_IDS } from '@jhandi/ledger/systemAccounts'
import { AppError } from '@jhandi/protocol/appError'
import type { Wallet, WalletTx } from '@jhandi/protocol/wallet'
import { db } from '#lib/db'
import { hasDailyBonus, insertBonus } from '#repositories/bonusRepository'
import { findUserById } from '#repositories/userRepository'
import { getSettings } from '#services/settingsService'
import { kathmanduDate, nextKathmanduMidnight } from '#utils/nepalTime'

const userAccountId = async (userId: string): Promise<string> =>
  (await findAccountId(db, 'USER', userId)) ?? getOrCreateAccount(db, 'USER', userId)

export const getWallet = async (userId: string): Promise<Wallet> => {
  const now = new Date()
  const [accountId, settings, claimed] = await Promise.all([
    userAccountId(userId),
    getSettings(),
    hasDailyBonus(userId, kathmanduDate(now)),
  ])
  return {
    balance: await getBalance(db, accountId),
    dailyBonusAmount: settings.DAILY_BONUS,
    dailyBonusAvailable: !claimed,
    nextDailyBonusAt: claimed ? nextKathmanduMidnight(now) : null,
  }
}

export const listWalletTransactions = async (
  userId: string,
  page: { cursor?: string | undefined; limit: number },
): Promise<{ items: WalletTx[]; nextCursor: string | null }> => {
  const accountId = await userAccountId(userId)
  let history
  try {
    history = await getAccountHistory(db, accountId, page)
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Invalid cursor')
  }
  return {
    items: history.items.map((item) => ({
      id: String(item.entryId),
      kind: item.kind,
      amount: item.amount,
      createdAt: item.createdAt.getTime(),
    })),
    nextCursor: history.nextCursor,
  }
}

// Once per Kathmandu calendar day; the unique index + idempotency key make double claims impossible.
export const claimDailyBonus = async (
  userId: string,
): Promise<{ amount: number; balance: number }> => {
  const user = await findUserById(userId)
  if (user?.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'This account is not active')

  const { DAILY_BONUS } = await getSettings()
  const bonusDate = kathmanduDate(new Date())
  const accountId = await userAccountId(userId)

  return db.transaction(async (tx) => {
    const inserted = await insertBonus(tx, {
      userId,
      kind: 'DAILY',
      amount: DAILY_BONUS,
      bonusDate,
    })
    if (!inserted) throw new AppError('ALREADY_CLAIMED', 'Daily bonus already claimed today')
    if (DAILY_BONUS > 0) {
      await postTransaction(tx, {
        kind: 'DAILY_BONUS',
        idempotencyKey: `daily:${userId}:${bonusDate}`,
        refType: 'USER',
        refId: userId,
        entries: [
          { accountId: SYSTEM_ACCOUNT_IDS.BONUS, amount: -DAILY_BONUS },
          { accountId, amount: DAILY_BONUS },
        ],
      })
    }
    return { amount: DAILY_BONUS, balance: await getBalance(tx, accountId) }
  })
}
