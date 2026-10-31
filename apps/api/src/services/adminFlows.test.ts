import { users } from '@jhandi/db/schema/users'
import { reconcileLedger } from '@jhandi/ledger/reconcile'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { db } from '#lib/db'
import {
  adminAdjustCoins,
  adminAudit,
  adminGetSettings,
  adminGetUser,
  adminOverview,
  adminSearchUsers,
  adminTopBalances,
  adminSetUserStatus,
  adminUpdateSetting,
} from '#services/adminService'
import { requestOtp, verifyOtp } from '#services/authService'
import { getSettings } from '#services/settingsService'
import { consumeRefreshToken, issueRefreshToken } from '#services/tokenService'
import { claimDailyBonus, getWallet } from '#services/walletService'

vi.mock('#lib/db', async () => (await import('#test/mockDb')).createMockDbModule())

let n = 0
const newUser = async (ip = '10.9.0.1') => {
  const phone = `+9779822${String(100_000 + n++).slice(-6)}`
  const { devCode = '' } = await requestOtp(phone, ip)
  return { id: (await verifyOtp(phone, devCode, ip)).user.id, phone }
}
const newAdmin = async () => {
  const { id } = await newUser('10.9.0.2')
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, id))
  return id
}

describe('admin', () => {
  it('overview counts coins, users and fees; top balances are sorted', async () => {
    const admin = await newAdmin()
    const rich = await newUser()
    await adminAdjustCoins(admin, {
      userId: rich.id,
      amount: 7_000,
      reason: 'test top-up',
      idempotencyKey: crypto.randomUUID(),
    })
    const o = await adminOverview()
    expect(o.users.total).toBeGreaterThanOrEqual(2)
    expect(o.users.signedUpToday).toBe(o.users.total)
    expect(o.coins.inWallets).toBeGreaterThanOrEqual(12_000)
    expect(o.coins.bonusesIssued).toBe(o.users.total * 5_000)
    expect(o.coins.adjustmentsNet).toBe(7_000)
    expect(o.rooms).toMatchObject({ live: 0, roundsInPlay: 0, players: 0 })
    expect(o.platformFee).toMatchObject({ total: 0, today: 0 })
    const top = await adminTopBalances(5)
    expect(top[0]).toMatchObject({ id: rich.id, balance: 12_000 })
    expect(top.every((u, i) => i === 0 || (top[i - 1]?.balance ?? 0) >= u.balance)).toBe(true)
  })

  it('finds users by phone, name and id, with a same-IP signal', async () => {
    const a = await newUser('10.9.5.5')
    await newUser('10.9.5.5')
    const byPhone = await adminSearchUsers(a.phone.slice(-6))
    expect(byPhone.map((u) => u.id)).toContain(a.id)
    expect((await adminSearchUsers(a.id))[0]?.id).toBe(a.id)
    const detail = await adminGetUser(a.id)
    expect(detail).toMatchObject({ balance: 5_000, status: 'ACTIVE', sameIpAccounts: 1 })
  })

  it('freezing a user logs them out, blocks coin actions, and is audited', async () => {
    const admin = await newAdmin()
    const victim = await newUser()
    const refresh = await issueRefreshToken(victim.id)

    const frozen = await adminSetUserStatus(admin, {
      userId: victim.id,
      status: 'FROZEN',
      reason: 'test freeze',
    })
    expect(frozen.status).toBe('FROZEN')
    await expect(consumeRefreshToken(refresh.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(claimDailyBonus(victim.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const audit = await adminAudit({ limit: 5 })
    expect(audit.items[0]).toMatchObject({
      actor: { id: admin },
      action: 'user.set_status',
      target: `user:${victim.id}`,
      data: { status: 'FROZEN', reason: 'test freeze' },
    })
    await expect(
      adminSetUserStatus(admin, { userId: admin, status: 'BANNED', reason: 'oops' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('adjusts coins through the ledger, once per idempotency key', async () => {
    const admin = await newAdmin()
    const user = await newUser()
    const key = crypto.randomUUID()
    await adminAdjustCoins(admin, {
      userId: user.id,
      amount: 250,
      reason: 'goodwill',
      idempotencyKey: key,
    })
    await adminAdjustCoins(admin, {
      userId: user.id,
      amount: 250,
      reason: 'goodwill',
      idempotencyKey: key,
    })
    expect((await getWallet(user.id)).balance).toBe(5_250)
    await adminAdjustCoins(admin, {
      userId: user.id,
      amount: -5_250,
      reason: 'claw back',
      idempotencyKey: crypto.randomUUID(),
    })
    expect((await getWallet(user.id)).balance).toBe(0)
    await expect(
      adminAdjustCoins(admin, {
        userId: user.id,
        amount: -1,
        reason: 'too much',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
    expect(await reconcileLedger(db)).toMatchObject({ ok: true })
  })

  it('updates a setting, invalidates the cache, and rejects unknown keys', async () => {
    const admin = await newAdmin()
    expect((await getSettings()).DAILY_BONUS).toBe(10)
    const after = await adminUpdateSetting(admin, { key: 'DAILY_BONUS', value: 25 })
    expect(after.DAILY_BONUS).toBe(25)
    expect((await getSettings()).DAILY_BONUS).toBe(25)
    expect((await adminGetSettings()).DAILY_LOSS_CAP).toBe(3_000)
    await expect(adminUpdateSetting(admin, { key: 'NOPE', value: 1 })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    await adminUpdateSetting(admin, { key: 'DAILY_BONUS', value: 10 })
  })
})
