// Drivers and drizzle wrap Postgres errors differently; walk the cause chain for the SQLSTATE.
export const pgErrorCode = (error: unknown): string | undefined => {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    const code = (current as Error & { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    current = current.cause
  }
  return undefined
}

export const CHECK_VIOLATION = '23514'
export const UNIQUE_VIOLATION = '23505'
