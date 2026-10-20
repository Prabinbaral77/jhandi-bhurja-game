import { createTestDb } from '@jhandi/db/testing'

// Used as the vi.mock factory for '#lib/db'.
export const createMockDbModule = async () => {
  const { db } = await createTestDb()
  return { db, sql: {} }
}
