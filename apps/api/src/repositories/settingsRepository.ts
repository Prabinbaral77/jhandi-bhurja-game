import { platformSettings } from '@jhandi/db/schema/platformSettings'
import { db } from '#lib/db'

export const loadAllSettings = async (): Promise<Record<string, unknown>> => {
  const rows = await db.select().from(platformSettings)
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}
