import { createSettingsReader, type PlatformSettings } from '@jhandi/db/settings'
import { db } from '#lib/db'

export type { PlatformSettings }

let reader = createSettingsReader(db)

export const getSettings = (): Promise<PlatformSettings> => reader()

// After an admin edit: this process sees the change at once; others within a minute.
export const invalidateSettings = (): void => {
  reader = createSettingsReader(db)
}
