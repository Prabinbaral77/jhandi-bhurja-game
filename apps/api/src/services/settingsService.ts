import { settingsSchema, type PlatformSettings } from '@jhandi/db/settings'
import { platformSettings } from '@jhandi/db/schema/platformSettings'
import { cached, invalidate } from '#lib/cache'
import { db } from '#lib/db'

export type { PlatformSettings }

const KEY = 'settings:v1'
const TTL_SEC = 60

// Hot path (every sign-up, bet validation on the API side): cached for a minute, shared through
// Redis when configured so an admin edit is visible on every node right away.
export const getSettings = (): Promise<PlatformSettings> =>
  cached(KEY, TTL_SEC, async () => {
    const rows = await db.select().from(platformSettings)
    return settingsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])))
  })

export const invalidateSettings = (): Promise<void> => invalidate(KEY)
