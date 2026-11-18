import { describe, expect, it } from 'vitest'
import {
  buildEventQueueState,
  filterQueueByName,
  findPlayerStatus,
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

  it('keeps table assignments visible when filtering by player name', () => {
    const ordered = [
      match('1', 'Alice', 'Bob'),
      match('2', 'Carol', 'Dave'),
    ]
    const state = buildEventQueueState(ordered, [], 2)
    const filtered = filterQueueByName(state, 'carol')

    expect(filtered.tables[0]?.match?.matchId).toBe('1')
    expect(filtered.tables[1]?.match?.matchId).toBe('2')
    expect(filtered.upNext).toHaveLength(0)
  })

  describe('findPlayerStatus', () => {
    const ordered = [
      match('1', 'Ana Cruz', 'Ben Ito'),
      match('2', 'Cleo Park', 'Dev Rao'),
      match('3', 'Eli Voss', 'Fay Zhou'),
      match('4', 'Gus Neal', 'Hana Oda', false),
    ]

    it('needs two characters and exactly one matching player', () => {
      const state = buildEventQueueState(ordered, [], 2)
      expect(findPlayerStatus(state, 'a', 2)).toBeNull()
      expect(findPlayerStatus(state, 'zzz', 2)).toBeNull()
      // "a" appears in several names; "an" matches only Ana and Hana.
      expect(findPlayerStatus(state, 'an', 2)).toBeNull()
    })

    it('reports a player who is on a table', () => {
      const state = buildEventQueueState(ordered, [], 2)
      const status = findPlayerStatus(state, 'ben', 2)
      expect(status?.kind).toBe('playing')
      expect(status?.title).toBe('On Table #1')
      expect(status?.detail).toBe('vs Ana Cruz')
    })

    it('reports up next and an estimate for later matches', () => {
      const state = buildEventQueueState(ordered, [], 2)
      expect(findPlayerStatus(state, 'eli', 2)?.kind).toBe('up-next')

      const longer = buildEventQueueState(
        [...ordered, match('5', 'Ivy Lund', 'Jon Kerr'), match('6', 'Kim Soto', 'Lee Marsh')],
        [],
        2,
      )
      const later = findPlayerStatus(longer, 'ivy', 2)
      expect(later?.kind).toBe('waiting')
      expect(later?.title).toBe('2 matches before yours')
      expect(later?.detail).toContain('about 12 min (estimate)')
    })

    it('reports resting players', () => {
      const ordered2 = [...ordered.slice(0, 2), { ...match('9', 'Mo Tate', 'Nia Bell', false), restReason: 'Mo Tate needs rest' }]
      const state = buildEventQueueState(ordered2, [], 2)
      expect(findPlayerStatus(state, 'mo tate', 2)?.kind).toBe('resting')
    })
  })

  describe('a player is never on two tables at once', () => {
    function pair(id: string, a: string, b: string, playable = true): QueueMatchView {
      return {
        matchId: id,
        stage: 'group',
        groupLabel: 'A',
        entryAId: a,
        entryBId: b,
        homeName: a,
        awayName: b,
        queuePosition: 1,
        playable,
        tableLocked: false,
      }
    }

    it('skips a queued match whose player is already on another table', () => {
      const ordered = [pair('1', 'ana', 'ben'), pair('2', 'ana', 'cy'), pair('3', 'dee', 'eli')]
      const state = buildEventQueueState(ordered, [], 2)
      expect(state.tables[0]!.match?.matchId).toBe('1')
      // ana is busy on table 1, so table 2 takes the next match she is not in
      expect(state.tables[1]!.match?.matchId).toBe('3')
      expect(state.upNext.map((m) => m.matchId)).toEqual(['2'])
    })

    it('respects a persisted table when filling the others', () => {
      const pinned = { ...pair('1', 'ana', 'ben'), assignedTable: 2, tableLocked: true }
      const ordered = [pair('0', 'ana', 'cy'), pinned, pair('3', 'dee', 'eli')]
      const state = buildEventQueueState(ordered, [], 2)
      expect(state.tables[1]!.match?.matchId).toBe('1')
      expect(state.tables[0]!.match?.matchId).toBe('3')
    })

    it('leaves a table free rather than double-booking when nothing else is playable', () => {
      const ordered = [pair('1', 'ana', 'ben'), pair('2', 'ana', 'cy')]
      const state = buildEventQueueState(ordered, [], 2)
      expect(state.tables[0]!.match?.matchId).toBe('1')
      expect(state.tables[1]!.match).toBeNull()
      expect(state.tables[1]!.nextMatch?.matchId).toBe('2')
    })
  })
})
