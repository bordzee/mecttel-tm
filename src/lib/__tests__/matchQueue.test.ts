import { describe, expect, it } from 'vitest'
import {
  MAX_CONSECUTIVE_MATCHES,
  buildEventMatchQueue,
  buildOrderedGroupQueue,
  consecutivePlays,
  wouldPlayTooSoon,
} from '../matchQueue'
import type { GroupMatch, TournamentEntry } from '../../types'

type TestMatch = {
  id: string
  entry_a_id: string
  entry_b_id: string
  status: 'scheduled' | 'completed'
  queue_order?: number
  completed_at?: string | null
}

function m(id: string, a: string, b: string, order: number): TestMatch {
  return {
    id,
    entry_a_id: a,
    entry_b_id: b,
    status: 'scheduled',
    queue_order: order,
  }
}

function completed(id: string, a: string, b: string, at: string): TestMatch {
  return {
    id,
    entry_a_id: a,
    entry_b_id: b,
    status: 'completed',
    completed_at: at,
  }
}

describe('matchQueue', () => {
  it('counts consecutive plays from most recent completed matches', () => {
    const history = [
      completed('1', 'A', 'B', '1'),
      completed('2', 'A', 'C', '2'),
    ]
    expect(consecutivePlays('A', history)).toBe(2)
    expect(wouldPlayTooSoon('A', history)).toBe(true)
    expect(wouldPlayTooSoon('B', history)).toBe(false)
  })

  it('orders pending matches to avoid a third consecutive match when possible', () => {
    const done = [
      completed('1', 'A', 'B', '1'),
      completed('2', 'A', 'C', '2'),
    ]
    const pending = [
      m('3', 'A', 'D', 0),
      m('4', 'B', 'C', 1),
    ]

    const ordered = buildOrderedGroupQueue(pending, done)
    expect(ordered[0]?.id).toBe('4')
    expect(ordered[1]?.id).toBe('3')
  })

  it('uses MAX_CONSECUTIVE_MATCHES of 2 to block a third in a row', () => {
    expect(MAX_CONSECUTIVE_MATCHES).toBe(2)
  })

  it('builds one global FIFO queue across groups by queue_order', () => {
    const entryMap = new Map<string, TournamentEntry>()
    const groups = [
      { id: 'g-f', label: 'F' },
      { id: 'g-g', label: 'G' },
      { id: 'g-a', label: 'A' },
    ]
    const groupMatches: GroupMatch[] = [
      {
        id: 'm1',
        group_id: 'g-f',
        entry_a_id: 'e1',
        entry_b_id: 'e2',
        status: 'scheduled',
        queue_order: 1,
      } as GroupMatch,
      {
        id: 'm2',
        group_id: 'g-g',
        entry_a_id: 'e3',
        entry_b_id: 'e4',
        status: 'scheduled',
        queue_order: 2,
      } as GroupMatch,
      {
        id: 'm3',
        group_id: 'g-a',
        entry_a_id: 'e5',
        entry_b_id: 'e6',
        status: 'scheduled',
        queue_order: 3,
      } as GroupMatch,
    ]

    const { ordered } = buildEventMatchQueue({
      groups,
      groupMatches,
      knockoutMatches: [],
      entryMap,
    })

    expect(ordered.map((m) => m.matchId)).toEqual(['m1', 'm2', 'm3'])
    expect(ordered.map((m) => m.groupLabel)).toEqual(['F', 'G', 'A'])
  })
})
