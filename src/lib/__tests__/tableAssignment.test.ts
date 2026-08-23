import { describe, expect, it } from 'vitest'
import { buildEventQueueState, getTableAnnouncement } from '../tableAssignment'
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
})
