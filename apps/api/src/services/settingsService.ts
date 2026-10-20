import { z } from 'zod'
import { loadAllSettings } from '#repositories/settingsRepository'

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
let cached: { value: PlatformSettings; expiresAt: number } | undefined

// Cached for a minute: settings change rarely and are read on hot paths.
export const getSettings = async (): Promise<PlatformSettings> => {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value
  const value = settingsSchema.parse(await loadAllSettings())
  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}
