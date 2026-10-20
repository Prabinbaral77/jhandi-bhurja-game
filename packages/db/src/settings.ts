import { z } from 'zod'
import type { DbOrTx } from '#database'
import { platformSettings } from '#schema/platformSettings'

const coins = z.number().int().nonnegative()

// docs/architecture.md §2.6 — seeded by migration 0002, editable by admins later.
const settingsSchema = z.object({
  SIGNUP_BONUS: coins,
  DAILY_BONUS: coins,
  MIN_HOST_DEPOSIT: coins,
  MIN_HOST_BANK_TO_CONTINUE: coins,
  PLATFORM_FEE_BPS: z.number().int().min(0).max(10_000),
  PRIVATE_ROOM_MAX_MEMBERS: z.number().int().positive(),
})

export type PlatformSettings = z.infer<typeof settingsSchema>

const CACHE_TTL_MS = 60_000

// Cached for a minute per process: settings change rarely and are read on hot paths.
export const createSettingsReader = (db: DbOrTx) => {
  let cached: { value: PlatformSettings; expiresAt: number } | undefined
  return async (): Promise<PlatformSettings> => {
    const now = Date.now()
    if (cached && cached.expiresAt > now) return cached.value
    const rows = await db.select().from(platformSettings)
    const value = settingsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])))
    cached = { value, expiresAt: now + CACHE_TTL_MS }
    return value
  }
}
