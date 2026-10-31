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
  adminSearchUsers,
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
