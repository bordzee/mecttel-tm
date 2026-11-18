import { describe, expect, it } from 'vitest'
import { formatDisplayDate } from '../formatDate'

describe('formatDisplayDate', () => {
  it('formats plain ISO dates without shifting the day across time zones', () => {
    expect(formatDisplayDate('2026-08-22', 'en-US')).toBe('Aug 22, 2026')
    expect(formatDisplayDate('2027-01-01', 'en-US')).toBe('Jan 1, 2027')
  })

  it('leaves anything else alone', () => {
    expect(formatDisplayDate('', 'en-US')).toBe('')
    expect(formatDisplayDate('next Friday', 'en-US')).toBe('next Friday')
    expect(formatDisplayDate('2026-02-31', 'en-US')).toBe('2026-02-31')
  })
})
