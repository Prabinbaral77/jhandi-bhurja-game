// Nepal is UTC+5:45 all year (no daylight saving).
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// Start of the current Kathmandu calendar day, as a Date.
export const kathmanduDayStart = (now: Date): Date => {
  const local = now.getTime() + NEPAL_OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - NEPAL_OFFSET_MS)
}
