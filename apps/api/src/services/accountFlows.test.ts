import { reconcileLedger } from '@jhandi/ledger/reconcile'
import { AppError } from '@jhandi/protocol/appError'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '#lib/db'
import { requestOtp, signInWithIdentity, verifyOtp } from '#services/authService'
import {
  consumeRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
} from '#services/tokenService'
import { claimDailyBonus, getWallet, listWalletTransactions } from '#services/walletService'

vi.mock('#lib/db', async () => (await import('#test/mockDb')).createMockDbModule())

let phoneCounter = 0
const newPhone = () => `+9779800${String(100_000 + phoneCounter++).slice(-6)}`

const signInByOtp = async (phone: string, ip = '10.0.0.1') => {
  const { devCode } = await requestOtp(phone, ip)
  if (!devCode) throw new Error('console sender should return devCode')
  return verifyOtp(phone, devCode, ip)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('sign-up and sign-in', () => {
  it('gives a new user exactly 5,000 coins, once', async () => {
    const phone = newPhone()
    const first = await signInByOtp(phone)
    expect(first).toMatchObject({ isNewUser: true, signupBonus: 5_000 })
    expect((await getWallet(first.user.id)).balance).toBe(5_000)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 61_000)
    const second = await signInByOtp(phone)
    expect(second).toMatchObject({ isNewUser: false, signupBonus: 0 })
    expect(second.user.id).toBe(first.user.id)
    expect((await getWallet(first.user.id)).balance).toBe(5_000)
  })

  it('handles two concurrent sign-ups of the same new identity', async () => {
    const subject = `google-${Date.now()}`
    const profile = { displayName: 'Sita', avatarUrl: null }
    const [a, b] = await Promise.all([
      signInWithIdentity('GOOGLE', subject, profile),
      signInWithIdentity('GOOGLE', subject, profile),
    ])
    expect(a.user.id).toBe(b.user.id)
    expect([a.isNewUser, b.isNewUser].sort()).toEqual([false, true])
    expect((await getWallet(a.user.id)).balance).toBe(5_000)
  })

  it('rejects a wrong code and locks after 5 wrong attempts', async () => {
    const phone = newPhone()
    const { devCode } = await requestOtp(phone, '10.0.0.2')
    const wrong = devCode === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      await expect(verifyOtp(phone, wrong, '10.0.0.2')).rejects.toMatchObject({
        code: 'INVALID_CODE',
      })
    }
    await expect(verifyOtp(phone, devCode ?? '', '10.0.0.2')).rejects.toThrow(
      /Too many wrong attempts/,
    )
  })

  it('a code works only once', async () => {
    const phone = newPhone()
    const { devCode = '' } = await requestOtp(phone, '10.0.0.3')
    await verifyOtp(phone, devCode, '10.0.0.3')
    await expect(verifyOtp(phone, devCode, '10.0.0.3')).rejects.toMatchObject({
      code: 'INVALID_CODE',
    })
  })

  it('makes the user wait 60 s before resending a code', async () => {
    const phone = newPhone()
    await requestOtp(phone, '10.0.0.4')
    await expect(requestOtp(phone, '10.0.0.4')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('tokens', () => {
  it('issues and verifies access tokens', async () => {
    const { accessToken } = await issueAccessToken('user-1')
    expect(await verifyAccessToken(accessToken)).toBe('user-1')
    await expect(verifyAccessToken(`${accessToken}x`)).rejects.toBeInstanceOf(AppError)
  })

  it('rotates refresh tokens and revokes everything when an old one is replayed', async () => {
    const { user } = await signInByOtp(newPhone(), '10.0.0.5')
    const first = await issueRefreshToken(user.id)
    expect(await consumeRefreshToken(first.token)).toBe(user.id)
    const second = await issueRefreshToken(user.id)

    // Within the grace window a replay is just rejected.
    await expect(consumeRefreshToken(first.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })

    // Later, a replay looks like theft: the newer token is revoked too.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 11_000)
    await expect(consumeRefreshToken(first.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(consumeRefreshToken(second.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })
})

describe('wallet', () => {
  it('pays the 10-coin daily bonus once per Kathmandu day', async () => {
    const { user } = await signInByOtp(newPhone(), '10.0.0.6')
    expect(await getWallet(user.id)).toMatchObject({
      dailyBonusAvailable: true,
      dailyBonusAmount: 10,
    })

    expect(await claimDailyBonus(user.id)).toEqual({ amount: 10, balance: 5_010 })
    await expect(claimDailyBonus(user.id)).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' })
    const wallet = await getWallet(user.id)
    expect(wallet).toMatchObject({ balance: 5_010, dailyBonusAvailable: false })
    expect(wallet.nextDailyBonusAt).toBeGreaterThan(Date.now())

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime((wallet.nextDailyBonusAt ?? 0) + 1_000)
    expect(await claimDailyBonus(user.id)).toEqual({ amount: 10, balance: 5_020 })
  })

  it('lists wallet transactions newest first', async () => {
    const { user } = await signInByOtp(newPhone(), '10.0.0.7')
    await claimDailyBonus(user.id)
    const page = await listWalletTransactions(user.id, { limit: 20 })
    expect(page.items.map((tx) => [tx.kind, tx.amount])).toEqual([
      ['DAILY_BONUS', 10],
      ['SIGNUP_BONUS', 5_000],
    ])
  })

  it('ledger reconciles after all of the above', async () => {
    expect(await reconcileLedger(db)).toMatchObject({ ok: true })
  })
})
