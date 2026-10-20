import { createTestDb } from '@jhandi/db/testing'
import { createSettingsReader } from '@jhandi/db/settings'

// Used as the vi.mock factory for '#lib/db'.
export const createMockDbModule = async () => {
  const { db } = await createTestDb()
  return { db, sql: {}, getSettings: createSettingsReader(db) }
}
