import { describe, expect, it } from 'vitest'
import { calculateTieFromRubbers, validateSetScore } from '../scoring'
import { needsManualRankResolution, computeStandings } from '../standings'
import { normalizeEntryName, rosterNameCollisionWarnings } from '../entryValidation'
import type { TournamentEntry } from '../../types'

describe('scoring', () => {
  it('rejects incomplete team ties', () => {
    const result = calculateTieFromRubbers(['W', null, null], 'SSS')
    expect(result.valid).toBe(false)
  })

  it('accepts valid best-of-3 set scores', () => {
    expect(validateSetScore(2, 0, 3).valid).toBe(true)
    expect(validateSetScore(2, 1, 3).valid).toBe(true)
    expect(validateSetScore(1, 0, 3).valid).toBe(false)
  })
})

describe('standings', () => {
  it('flags non-adjacent ties', () => {
    const rows = [
      { entryId: 'a', name: 'A', played: 2, wins: 2, losses: 0, scoreFor: 6, scoreAgainst: 2, diff: 4, rank: 1 },
      { entryId: 'b', name: 'B', played: 2, wins: 1, losses: 1, scoreFor: 5, scoreAgainst: 5, diff: 0, rank: 2 },
      { entryId: 'c', name: 'C', played: 2, wins: 1, losses: 1, scoreFor: 4, scoreAgainst: 4, diff: 0, rank: 3 },
      { entryId: 'd', name: 'D', played: 2, wins: 0, losses: 2, scoreFor: 2, scoreAgainst: 6, diff: -4, rank: 4 },
    ]
    expect(needsManualRankResolution(rows)).toBe(true)
  })

  it('ignores completed matches without a valid winner', () => {
    const entryMap = new Map<string, TournamentEntry>()
    const rows = computeStandings(
      ['a', 'b'],
      [
        {
          id: 'm1',
          tournament_id: 't',
          event_id: 'e',
          group_id: 'g',
          entry_a_id: 'a',
          entry_b_id: 'b',
          score_a: 2,
          score_b: 1,
          rubber_results: null,
          winner_entry_id: 'invalid',
          status: 'completed',
          outcome: 'normal',
        },
      ],
      entryMap,
    )
    expect(rows.every((r) => r.played === 0)).toBe(true)
  })

  it('ranks seeded entries first before any group matches are played', () => {
    const entryMap = new Map<string, TournamentEntry>([
      [
        'a',
        {
          id: 'a',
          tournament_id: 't',
          event_id: 'e',
          entry_type: 'player',
          team_id: null,
          player_id: 'p1',
          pair_id: null,
          seeded: false,
          player: {
            id: 'p1',
            tournament_id: 't',
            event_id: 'e',
            name: 'Unseeded',
            organization: null,
            seeded: false,
          },
        },
      ],
      [
        'b',
        {
          id: 'b',
          tournament_id: 't',
          event_id: 'e',
          entry_type: 'player',
          team_id: null,
          player_id: 'p2',
          pair_id: null,
          seeded: true,
          player: {
            id: 'p2',
            tournament_id: 't',
            event_id: 'e',
            name: 'Seeded B',
            organization: null,
            seeded: true,
          },
        },
      ],
      [
        'c',
        {
          id: 'c',
          tournament_id: 't',
          event_id: 'e',
          entry_type: 'player',
          team_id: null,
          player_id: 'p3',
          pair_id: null,
          seeded: true,
          player: {
            id: 'p3',
            tournament_id: 't',
            event_id: 'e',
            name: 'Seeded A',
            organization: null,
            seeded: true,
          },
        },
      ],
    ])

    const rows = computeStandings(['a', 'b', 'c'], [], entryMap)
    expect(rows.map((r) => r.entryId)).toEqual(['c', 'b', 'a'])
    expect(rows[0]?.rank).toBe(1)
    expect(rows[1]?.rank).toBe(2)
    expect(rows[0]?.seeded).toBe(true)
    expect(rows[2]?.seeded).toBe(false)
  })
})

describe('entryValidation', () => {
  it('detects cross-team roster collisions', () => {
    const entries = [
      {
        id: '1',
        tournament_id: 't',
        event_id: 'e',
        entry_type: 'team',
        team_id: 'team-a',
        player_id: null,
        pair_id: null,
        seeded: null,
        team: { id: 'team-a', tournament_id: 't', event_id: 'e', name: 'Alpha', organization: null, seeded: null },
      },
      {
        id: '2',
        tournament_id: 't',
        event_id: 'e',
        entry_type: 'team',
        team_id: 'team-b',
        player_id: null,
        pair_id: null,
        seeded: null,
        team: { id: 'team-b', tournament_id: 't', event_id: 'e', name: 'Beta', organization: null, seeded: null },
      },
    ] as TournamentEntry[]

    const rosters = new Map([
      ['team-a', ['Alex Chen']],
      ['team-b', ['alex chen']],
    ])
    const warnings = rosterNameCollisionWarnings(entries, rosters)
    expect(warnings.length).toBe(1)
    expect(normalizeEntryName('Alex Chen')).toBe('alex chen')
  })
})
