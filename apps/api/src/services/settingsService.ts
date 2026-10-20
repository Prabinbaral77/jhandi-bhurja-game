import { createSettingsReader, type PlatformSettings } from '@jhandi/db/settings'
import { db } from '#lib/db'

export type { PlatformSettings }

export const getSettings = createSettingsReader(db)
