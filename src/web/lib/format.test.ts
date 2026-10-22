import { describe, expect, it } from 'vitest'
import { formatTimestamp } from './format'

describe('formatTimestamp', () => {
  it('renders "never" for a null timestamp', () => {
    expect(formatTimestamp(null)).toBe('never')
  })

  it('formats an ISO string using the host locale', () => {
    const iso = '2026-03-04T05:06:07.000Z'
    expect(formatTimestamp(iso)).toBe(new Date(iso).toLocaleString())
  })
})
