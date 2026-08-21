import { describe, expect, it } from 'vitest'
import {
  computeKnockoutAdvancement,
  generateKnockoutPairings,
  type KnockoutMatchLike,
} from '../knockoutSeeding'
import type { StandingRow, TournamentEntry } from '../../types'

function mockAdvancers(groupCount: number, advanceCount: number) {
  const advancersByGroup = new Map<string, StandingRow[]>()
  const groupOrder: string[] = []
  for (let g = 0; g < groupCount; g++) {
    const gid = `g${g}`
    groupOrder.push(gid)
    const rows: StandingRow[] = []
    for (let r = 0; r < advanceCount; r++) {
      rows.push({
        entryId: `${gid}-${r}`,
        name: `G${g}#${r + 1}`,
        played: 3,
        wins: 2 - r,
        losses: r,
        scoreFor: 0,
        scoreAgainst: 0,
        diff: 0,
        rank: r + 1,
      })
    }
    advancersByGroup.set(gid, rows)
  }
  return { advancersByGroup, groupOrder }
}

function treeToMatches(tree: ReturnType<typeof generateKnockoutPairings>['tree']): KnockoutMatchLike[] {
  const keyToId = new Map(tree.map((n) => [n.key, n.key]))
  return tree.map((n) => ({
    id: n.key,
    round: n.slot.round,
    slot: n.slot.slot,
    bracket_side: n.slot.bracketSide,
    entry_a_id: n.slot.entryAId,
    entry_b_id: n.slot.entryBId,
    winner_entry_id: n.slot.winnerEntryId ?? null,
    source_match_a_id: n.slot.sourceAKey ? (keyToId.get(n.slot.sourceAKey) ?? null) : null,
    source_match_b_id: n.slot.sourceBKey ? (keyToId.get(n.slot.sourceBKey) ?? null) : null,
    status: n.slot.isBye
      ? 'completed'
      : n.slot.entryAId && n.slot.entryBId
        ? 'scheduled'
        : 'pending',
    outcome: n.slot.isBye ? 'bye' : 'normal',
    pending_odd_round: n.slot.pendingOddRound ?? false,
    is_odd_play_in: n.slot.isOddPlayIn ?? false,
    feeder_source_match_ids: (n.slot.feederSourceKeys ?? [])
      .map((key) => keyToId.get(key))
      .filter((id): id is string => !!id),
  }))
}

function completeRound(matches: KnockoutMatchLike[], round: KnockoutMatchLike['round']) {
  for (const m of matches.filter((x) => x.round === round && x.entry_a_id && x.entry_b_id)) {
    m.status = 'completed'
    m.winner_entry_id = m.entry_a_id
  }
}

describe('knockoutSeeding', () => {
  const entries = new Map<string, TournamentEntry>()

  it('builds block bracket tree without undefined sources for 7 groups', () => {
    const { advancersByGroup, groupOrder } = mockAdvancers(7, 2)
    const { tree, warnings } = generateKnockoutPairings(
      advancersByGroup,
      groupOrder,
      entries,
      2,
      'block',
    )

    expect(warnings.some((w) => w.message.includes('even number of groups'))).toBe(true)
    expect(tree.some((n) => n.slot.sourceBKey === undefined && n.slot.sourceAKey)).toBe(false)

    const matches = treeToMatches(tree)
    const firstRound = matches.filter((m) => m.round === 'r16' || m.round === 'quarter')
    completeRound(matches, firstRound[0]?.round ?? 'quarter')
    const updates = computeKnockoutAdvancement(matches)

    expect(updates.size).toBeGreaterThan(0)
  })

  it.each(['cross', 'block'] as const)(
    'uses seeded bye bracket with group-rank play-in for 12 advancers (6 groups × 2, %s)',
    (bracketType) => {
      const { advancersByGroup, groupOrder } = mockAdvancers(6, 2)
      const { tree, warnings } = generateKnockoutPairings(
        advancersByGroup,
        groupOrder,
        entries,
        2,
        bracketType,
      )

      expect(warnings.some((w) => w.message.includes('group-rank play-in'))).toBe(true)

      const r16 = tree.filter((n) => n.slot.round === 'r16')
      expect(r16).toHaveLength(8)
      expect(r16.filter((n) => n.slot.isBye)).toHaveLength(4)
      const played = r16.filter((n) => n.slot.entryAId && n.slot.entryBId)
      expect(played).toHaveLength(4)

      for (const q of played) {
        const groupA = q.slot.entryAId!.split('-')[0]
        const groupB = q.slot.entryBId!.split('-')[0]
        expect(groupA).not.toBe(groupB)
      }

      expect(tree.filter((n) => n.slot.round === 'quarter')).toHaveLength(4)
      expect(tree.filter((n) => n.slot.round === 'semi')).toHaveLength(2)
      expect(tree.filter((n) => n.slot.round === 'third_place')).toHaveLength(1)
      expect(tree.filter((n) => n.slot.round === 'final')).toHaveLength(1)

      const matches = treeToMatches(tree)
      completeRound(matches, 'r16')
      const updates = computeKnockoutAdvancement(matches)

      expect(updates.size).toBeGreaterThan(0)
      for (const qf of matches.filter((m) => m.round === 'quarter')) {
        if (updates.has(qf.id)) {
          expect(updates.get(qf.id)?.status).toBe('scheduled')
        }
      }
    },
  )

  it.each(['cross', 'block'] as const)(
    'keeps group-rank pairing for 8 advancers (4 groups × 2, %s)',
    (bracketType) => {
      const { advancersByGroup, groupOrder } = mockAdvancers(4, 2)
      const { tree, warnings } = generateKnockoutPairings(
        advancersByGroup,
        groupOrder,
        entries,
        2,
        bracketType,
      )

      expect(warnings.some((w) => w.message.includes('seeded bye bracket'))).toBe(false)

      const matches = treeToMatches(tree)
      expect(matches.filter((m) => m.round === 'quarter')).toHaveLength(4)
      expect(matches.filter((m) => m.round === 'quarter' && m.outcome === 'bye')).toHaveLength(0)
      expect(matches.filter((m) => m.round === 'semi')).toHaveLength(2)
      expect(matches.filter((m) => m.round === 'third_place')).toHaveLength(1)
      expect(matches.filter((m) => m.round === 'final')).toHaveLength(1)

      completeRound(matches, 'quarter')
      const updates = computeKnockoutAdvancement(matches)

      expect(updates.get('s-0')).toMatchObject({
        entry_a_id: 'g0-0',
        entry_b_id: 'g1-0',
        status: 'scheduled',
      })
      expect(updates.get('s-1')).toMatchObject({
        entry_a_id: 'g2-0',
        entry_b_id: 'g3-0',
        status: 'scheduled',
      })
    },
  )

  it('advances quarters to semis without source links using slot order (legacy)', () => {
    const { advancersByGroup, groupOrder } = mockAdvancers(4, 2)
    const { tree } = generateKnockoutPairings(
      advancersByGroup,
      groupOrder,
      entries,
      2,
      'block',
    )

    const matches = tree
      .filter((n) => ['quarter', 'semi', 'final'].includes(n.slot.round))
      .map((n) => ({
        id: n.key,
        round: n.slot.round,
        slot: n.slot.slot,
        bracket_side: n.slot.bracketSide,
        entry_a_id: n.slot.entryAId,
        entry_b_id: n.slot.entryBId,
        winner_entry_id: null as string | null,
        source_match_a_id: null,
        source_match_b_id: null,
        status: n.slot.entryAId && n.slot.entryBId ? 'scheduled' : 'pending',
        outcome: 'normal',
        pending_odd_round: n.slot.pendingOddRound ?? false,
        is_odd_play_in: n.slot.isOddPlayIn ?? false,
        feeder_source_match_ids: [] as string[],
      }))

    completeRound(matches, 'quarter')
    const updates = computeKnockoutAdvancement(matches)

    expect(updates.get('s-0')?.status).toBe('scheduled')
    expect(updates.get('s-1')?.status).toBe('scheduled')
  })

  it('does not use legacy slot pairing when quarter count exceeds semi pairs', () => {
    const { advancersByGroup, groupOrder } = mockAdvancers(6, 2)
    const { tree } = generateKnockoutPairings(
      advancersByGroup,
      groupOrder,
      entries,
      2,
      'cross',
    )

    const matches = tree
      .filter((n) => ['r16', 'quarter', 'semi', 'final'].includes(n.slot.round))
      .map((n) => ({
        id: n.key,
        round: n.slot.round,
        slot: n.slot.slot,
        bracket_side: n.slot.bracketSide,
        entry_a_id: n.slot.entryAId,
        entry_b_id: n.slot.entryBId,
        winner_entry_id: n.slot.winnerEntryId ?? null,
        source_match_a_id: null,
        source_match_b_id: null,
        status: n.slot.isBye ? 'completed' : n.slot.entryAId && n.slot.entryBId ? 'scheduled' : 'pending',
        outcome: n.slot.isBye ? 'bye' : 'normal',
        pending_odd_round: n.slot.pendingOddRound ?? false,
        is_odd_play_in: n.slot.isOddPlayIn ?? false,
        feeder_source_match_ids: [] as string[],
      }))

    completeRound(matches, 'r16')
    const updates = computeKnockoutAdvancement(matches)

    expect(updates.size).toBe(0)
  })
})
