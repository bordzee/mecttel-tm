import { describe, expect, it } from 'vitest'
import {
  assignEntriesToGroups,
  canAddEntryToGroup,
  validateSeededPlacementPossible,
} from '../groupAssignment'
import { getStartLayoutOptions, isLayoutCompatibleWithBlock } from '../groupLayout'
import { suggestBalanceGroup, validateLateJoinTarget } from '../lateJoinAssignment'
import type { TournamentEntry } from '../../types'

function playerEntry(
  id: string,
  name: string,
  org: string | null,
  seeded: boolean | null,
): TournamentEntry {
  return {
    id,
    tournament_id: 't',
    event_id: 'e',
    entry_type: 'player',
    team_id: null,
    player_id: id,
    pair_id: null,
    seeded,
    player: {
      id,
      tournament_id: 't',
      event_id: 'e',
      name,
      organization: org,
      seeded,
    },
  }
}

describe('groupAssignment', () => {
  it('never places more than 2 seeded in a group', () => {
    const entries = [
      playerEntry('1', 'A', 'Org1', true),
      playerEntry('2', 'B', 'Org2', true),
      playerEntry('3', 'C', 'Org3', true),
      playerEntry('4', 'D', null, false),
      playerEntry('5', 'E', null, false),
      playerEntry('6', 'F', null, false),
    ]
    const result = assignEntriesToGroups(entries, 2)
    expect(result.error).toBeUndefined()
    for (const group of result.groups) {
      const groupEntries = group.entryIds.map((id) => entries.find((e) => e.id === id)!)
      expect(groupEntries.filter((e) => e.seeded === true).length).toBeLessThanOrEqual(2)
    }
  })

  it('rejects 2 seeded from the same org in one group', () => {
    const group = [playerEntry('1', 'A', 'Club', true)]
    const next = playerEntry('2', 'B', 'Club', true)
    expect(canAddEntryToGroup(group, next).ok).toBe(false)
  })

  it('fails when too many seeded for group count', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      playerEntry(String(i), `P${i}`, `O${i}`, true),
    )
    expect(validateSeededPlacementPossible(entries, 2)).toMatch(/Cannot assign groups/)
  })

  it('allows unseeded same org with warning path', () => {
    const group = [playerEntry('1', 'A', 'Club', true)]
    const unseeded = playerEntry('2', 'B', 'Club', false)
    expect(canAddEntryToGroup(group, unseeded).ok).toBe(true)
    const validation = validateLateJoinTarget(group, unseeded)
    expect(validation.ok).toBe(true)
    expect(validation.warnings.length).toBeGreaterThan(0)
  })

  it('summarizes org sibling warnings once per organization', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      playerEntry(String(i), `P${i}`, i < 8 ? 'CIT' : 'MECTTEL', null),
    )
    const result = assignEntriesToGroups(entries, 2)
    const orgWarnings = result.warnings.filter((w) => w.type === 'org_sibling')
    expect(orgWarnings).toHaveLength(1)
    expect(orgWarnings[0]?.message).toContain('CIT')
    expect(orgWarnings[0]?.message).toContain('up to')
  })
})

describe('groupLayout', () => {
  it('offers 3×3 and 5+4 for 9 entries without duplicating equal splits', () => {
    const options = getStartLayoutOptions(9, {})
    const labels = options.map((o) => o.label)
    expect(labels).toContain('3 groups × 3')
    expect(labels.some((l) => l.includes('5+4'))).toBe(true)
    expect(labels.filter((l) => l.includes('3+3+3'))).toHaveLength(0)
  })

  it('marks odd group counts incompatible with Block bracket', () => {
    const options = getStartLayoutOptions(9, {})
    const threeByThree = options.find((o) => o.label === '3 groups × 3')
    const fiveFour = options.find((o) => o.label.includes('5+4'))
    expect(threeByThree).toBeDefined()
    expect(fiveFour).toBeDefined()
    expect(isLayoutCompatibleWithBlock(threeByThree!)).toBe(false)
    expect(isLayoutCompatibleWithBlock(fiveFour!)).toBe(true)
  })

  it('offers 3+3+3+2 for 11 entries when a group of 2 is required', () => {
    const options = getStartLayoutOptions(11, {})
    const labels = options.map((o) => o.label)
    expect(labels).toContain('4 groups (3+3+3+2)')
    expect(labels).toContain('3 groups (4+4+3)')

    const fourGroups = options.find((o) => o.key === 'uneven-3-3-3-2')
    expect(fourGroups?.groupSizes).toEqual([3, 3, 3, 2])
  })
})

describe('lateJoinAssignment', () => {
  it('suggests the smallest valid group', () => {
    const groups = [
      {
        groupId: 'g1',
        label: 'A',
        entries: [
          playerEntry('1', 'A', 'X', true),
          playerEntry('2', 'B', 'Y', null),
        ],
      },
      {
        groupId: 'g2',
        label: 'B',
        entries: [playerEntry('3', 'C', 'Z', null)],
      },
    ]
    const late = playerEntry('4', 'D', 'W', false)
    const suggestion = suggestBalanceGroup(groups, late)
    expect(suggestion?.groupId).toBe('g2')
  })
})
