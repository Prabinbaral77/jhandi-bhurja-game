import { describe, expect, it } from 'vitest'
import { kathmanduDate, nextKathmanduMidnight } from '#utils/nepalTime'

describe('Nepal time (UTC+5:45)', () => {
  it('rolls the date at Kathmandu midnight, not UTC midnight', () => {
    expect(kathmanduDate(new Date('2026-10-20T18:14:00Z'))).toBe('2026-10-20')
    expect(kathmanduDate(new Date('2026-10-20T18:15:00Z'))).toBe('2026-10-21')
  })

  it('finds the next Kathmandu midnight', () => {
    expect(nextKathmanduMidnight(new Date('2026-10-20T10:00:00Z'))).toBe(
      Date.parse('2026-10-20T18:15:00Z'),
    )
  })
})
