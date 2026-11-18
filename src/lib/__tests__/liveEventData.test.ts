import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = { entries: 0, matches: 0 }
let matchEntryIds: string[] = ['a', 'b']

vi.mock('../tournamentService', () => ({
  fetchEvent: async () => ({ id: 'e' }),
  fetchGroups: async () => [{ id: 'g1' }],
  fetchGroupMatches: async () => {
    calls.matches++
    return [{ entry_a_id: matchEntryIds[0], entry_b_id: matchEntryIds[1] }]
  },
  fetchKnockoutMatches: async () => [],
  fetchGroupMembers: async () => matchEntryIds.map((entry_id) => ({ group_id: 'g1', entry_id })),
  fetchEntries: async () => {
    calls.entries++
    return matchEntryIds.map((id) => ({ id }))
  },
}))

import { createLiveEventLoader } from '../liveEventData'

describe('createLiveEventLoader', () => {
  beforeEach(() => {
    calls.entries = 0
    calls.matches = 0
    matchEntryIds = ['a', 'b']
    vi.useRealTimers()
  })

  it('reuses participants between live updates but always re-reads matches', async () => {
    const load = createLiveEventLoader({ withMembers: true })
    await load('t', 'e', { force: true })
    await load('t', 'e')
    await load('t', 'e')
    expect(calls.entries).toBe(1)
    expect(calls.matches).toBe(3)
  })

  it('re-reads participants when a match mentions someone new (late check-in)', async () => {
    const load = createLiveEventLoader({ withMembers: false })
    await load('t', 'e', { force: true })
    matchEntryIds = ['a', 'c']
    const data = await load('t', 'e')
    expect(calls.entries).toBe(2)
    expect(data.entries.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('re-reads participants when the cached copy is old, and on a forced load', async () => {
    vi.useFakeTimers()
    const load = createLiveEventLoader({ withMembers: false, maxEntryAgeMs: 1000 })
    await load('t', 'e', { force: true })
    vi.advanceTimersByTime(1500)
    await load('t', 'e')
    expect(calls.entries).toBe(2)
    await load('t', 'e', { force: true })
    expect(calls.entries).toBe(3)
  })

  it('does not share a cache between divisions', async () => {
    const load = createLiveEventLoader({ withMembers: false })
    await load('t', 'e1', { force: true })
    await load('t', 'e2')
    expect(calls.entries).toBe(2)
  })
})
