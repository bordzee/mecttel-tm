import { describe, expect, it } from 'vitest'
import {
  buildEventQueueState,
  getTableAnnouncement,
  UP_NEXT_DISPLAY_LIMIT,
} from '../tableAssignment'
import { formatTableLabel, normalizeTableCount } from '../tableLabels'
import type { QueueMatchView } from '../matchQueue'

function match(id: string, home: string, away: string, playable = true): QueueMatchView {
  return {
    matchId: id,
    stage: 'group',
    groupLabel: 'A',
    entryAId: `a-${id}`,
    entryBId: `b-${id}`,
    homeName: home,
    awayName: away,
    queuePosition: 1,
    playable,
    tableLocked: false,
  }
}

describe('tableAssignment', () => {
  it('formats table labels as Table #N', () => {
    expect(formatTableLabel(1)).toBe('Table #1')
    expect(formatTableLabel(3)).toBe('Table #3')
  })

  it('normalizes table count to at least 1', () => {
    expect(normalizeTableCount(undefined)).toBe(1)
    expect(normalizeTableCount(0)).toBe(1)
    expect(normalizeTableCount(4)).toBe(4)
  })

  it('keeps full up next queue for table logic while UI caps display at 10', () => {
    expect(UP_NEXT_DISPLAY_LIMIT).toBe(10)
    const ordered = Array.from({ length: 15 }, (_, i) =>
      match(String(i + 1), `H${i}`, `A${i}`),
    )
    const state = buildEventQueueState(ordered, [], 1)
    expect(state.upNext).toHaveLength(14)
    expect(state.upNext.slice(0, UP_NEXT_DISPLAY_LIMIT)).toHaveLength(10)
  })

  it('assigns playable matches to table slots', () => {
    const ordered = [
      match('1', 'A', 'B'),
      match('2', 'C', 'D'),
      match('3', 'E', 'F'),
    ]
    const state = buildEventQueueState(ordered, [], 2)

    expect(state.tables).toHaveLength(2)
    expect(state.tables[0]?.match?.matchId).toBe('1')
    expect(state.tables[0]?.estimatedTable ?? state.tables[0]?.match?.estimatedTable).toBeTruthy()
    expect(state.tables[1]?.match?.matchId).toBe('2')
    expect(state.upNext[0]?.matchId).toBe('3')
  })

  it('keeps locked table assignments', () => {
    const ordered: QueueMatchView[] = [
      {
        ...match('1', 'A', 'B'),
        assignedTable: 2,
        tableLocked: true,
        calledAt: '2026-01-01T00:00:00.000Z',
      },
      match('2', 'C', 'D'),
    ]
    const state = buildEventQueueState(ordered, [], 2)

    expect(state.tables[1]?.match?.matchId).toBe('1')
    expect(state.tables[1]?.status).toBe('called')
    expect(state.tables[0]?.match?.matchId).toBe('2')
  })

  it('builds announcement for next match on a table', () => {
    const ordered = [
      match('1', 'A', 'B'),
      match('2', 'C', 'D'),
    ]
    const state = buildEventQueueState(ordered, [], 1)
    const ann = getTableAnnouncement(1, state)
    expect(ann.nextMatch?.matchId).toBe('1')
    expect(ann.noMoreMatches).toBe(false)
    expect(ann.waitingForRest).toBe(false)
  })

  it('fills vacant tables from the front of up next without reshuffling locked tables', () => {
    const ordered: QueueMatchView[] = [
      {
        ...match('1', 'A', 'B'),
        assignedTable: 2,
        tableLocked: true,
      },
      match('2', 'C', 'D'),
      match('3', 'E', 'F'),
    ]
    const state = buildEventQueueState(ordered, [], 2)

    expect(state.tables[0]?.match?.matchId).toBe('2')
    expect(state.tables[1]?.match?.matchId).toBe('1')
    expect(state.upNext.map((m) => m.matchId)).toEqual(['3'])
  })

  it('uses first up next match for announcement when table is idle', () => {
    const ordered = [
      match('1', 'A', 'B'),
      match('2', 'C', 'D'),
      match('3', 'E', 'F'),
    ]
    const state = buildEventQueueState(ordered, [], 2)
    const ann = getTableAnnouncement(1, {
      ...state,
      tables: state.tables.map((slot) =>
        slot.tableNumber === 1 ? { ...slot, match: null, status: 'idle' as const } : slot,
      ),
    })

    expect(ann.nextMatch?.matchId).toBe('3')
  })
})
