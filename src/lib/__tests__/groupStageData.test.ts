import { describe, expect, it } from 'vitest'
import { buildGroupStageData } from '../groupStageData'
import type { Group, GroupMatch, TournamentEntry } from '../../types'

function entry(id: string, name: string): TournamentEntry {
  return {
    id,
    tournament_id: 't',
    event_id: 'e',
    entry_type: 'player',
    team_id: null,
    player_id: id,
    pair_id: null,
    seeded: null,
    player: { id, tournament_id: 't', event_id: 'e', name, organization: null, seeded: null },
  }
}

function match(id: string, a: string, b: string, done?: [number, number]): GroupMatch {
  return {
    id,
    tournament_id: 't',
    event_id: 'e',
    group_id: 'g1',
    entry_a_id: a,
    entry_b_id: b,
    score_a: done ? done[0] : null,
    score_b: done ? done[1] : null,
    rubber_results: null,
    winner_entry_id: done ? (done[0] > done[1] ? a : b) : null,
    status: done ? 'completed' : 'scheduled',
    outcome: 'normal',
  }
}

const group: Group = { id: 'g1', tournament_id: 't', event_id: 'e', label: 'A' }
const members = ['a', 'b', 'c'].map((entry_id) => ({ group_id: 'g1', entry_id }))
const entryMap = new Map([entry('a', 'Ana'), entry('b', 'Ben'), entry('c', 'Cy')].map((e) => [e.id, e]))

describe('buildGroupStageData', () => {
  it('splits pending from completed matches and ranks by results', () => {
    const [data] = buildGroupStageData(
      [group],
      members,
      [match('m1', 'a', 'b', [3, 0]), match('m2', 'a', 'c'), match('m3', 'b', 'c')],
      entryMap,
    )!
    expect(data!.completed).toHaveLength(1)
    expect(data!.pending).toHaveLength(2)
    expect(data!.groupPlayComplete).toBe(false)
    expect(data!.rows[0]!.name).toBe('Ana')
    expect(data!.entryIds).toEqual(['a', 'b', 'c'])
  })

  it('marks a group complete once every match is scored', () => {
    const [data] = buildGroupStageData(
      [group],
      members,
      [match('m1', 'a', 'b', [3, 0]), match('m2', 'a', 'c', [3, 1]), match('m3', 'b', 'c', [3, 2])],
      entryMap,
    )!
    expect(data!.groupPlayComplete).toBe(true)
    expect(data!.rows.map((r) => r.name)).toEqual(['Ana', 'Ben', 'Cy'])
  })

  it('treats a group with no matches as not complete and flags manual ranks', () => {
    const [data] = buildGroupStageData(
      [{ ...group, manual_rank_order: ['c', 'b', 'a'] }],
      members,
      [],
      entryMap,
    )!
    expect(data!.groupPlayComplete).toBe(false)
    expect(data!.hasManualRanks).toBe(true)
  })
})
