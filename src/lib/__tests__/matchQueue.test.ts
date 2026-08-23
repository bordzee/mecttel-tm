import { describe, expect, it } from 'vitest'
import {
  MAX_CONSECUTIVE_MATCHES,
  buildOrderedGroupQueue,
  consecutivePlays,
  wouldPlayTooSoon,
} from '../matchQueue'

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
})
