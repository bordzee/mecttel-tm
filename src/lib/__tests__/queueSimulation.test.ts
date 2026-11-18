import { describe, expect, it } from 'vitest'
import { buildEventMatchQueue } from '../matchQueue'
import { buildEventQueueState } from '../tableAssignment'
import { generateRoundRobinPairsOrdered } from '../roundRobin'
import type { GroupMatch, TournamentEntry } from '../../types'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function entry(id: string): TournamentEntry {
  return {
    id,
    tournament_id: 't',
    event_id: 'e',
    entry_type: 'player',
    team_id: null,
    player_id: id,
    pair_id: null,
    seeded: null,
    player: { id, tournament_id: 't', event_id: 'e', name: id, organization: null, seeded: null },
  }
}

/** Plays a whole group stage through the live queue the way an organizer would. */
function playThroughQueue(groupSizes: number[], tables: number, seed: number) {
  const rand = rng(seed)
  const groups = groupSizes.map((_, i) => ({ id: `g${i}`, label: String.fromCharCode(65 + i) }))
  const entries = new Map<string, TournamentEntry>()
  const matches: GroupMatch[] = []
  groupSizes.forEach((size, gi) => {
    const ids = Array.from({ length: size }, (_, pi) => `g${gi}p${pi}`)
    ids.forEach((id) => entries.set(id, entry(id)))
    for (const p of generateRoundRobinPairsOrdered(ids)) {
      matches.push({
        id: `m-${p.entryA}-${p.entryB}`,
        tournament_id: 't',
        event_id: 'e',
        group_id: `g${gi}`,
        entry_a_id: p.entryA,
        entry_b_id: p.entryB,
        score_a: null,
        score_b: null,
        rubber_results: null,
        winner_entry_id: null,
        status: 'scheduled',
        outcome: 'normal',
        queue_order: p.queueOrder,
      })
    }
  })

  let clock = 0
  const problems: string[] = []
  for (let step = 0; step < 500; step++) {
    const pending = matches.filter((m) => m.status !== 'completed')
    if (!pending.length) return { problems, steps: step }
    const queue = buildEventMatchQueue({ groups, groupMatches: matches, knockoutMatches: [], entryMap: entries })
    const state = buildEventQueueState(queue.ordered, queue.entryWait, tables)
    const onTables = state.tables.filter((t) => t.match)

    const seen = new Set<string>()
    for (const t of onTables) {
      for (const id of [t.match!.entryAId, t.match!.entryBId]) {
        if (seen.has(id)) problems.push(`step ${step}: ${id} is on two tables`)
        seen.add(id)
      }
    }
    if (!onTables.length) {
      problems.push(`step ${step}: stalled with ${pending.length} matches left (${pending.map((m) => m.id).join(', ')})`)
      return { problems, steps: step }
    }
    // an organizer finishes one of the matches currently on a table
    const done = onTables[Math.floor(rand() * onTables.length)]!.match!
    const m = matches.find((x) => x.id === done.matchId)!
    m.status = 'completed'
    m.completed_at = new Date(1_700_000_000_000 + clock++ * 60_000).toISOString()
    m.score_a = 3
    m.score_b = 0
    m.winner_entry_id = m.entry_a_id
  }
  problems.push('did not finish in 500 steps')
  return { problems, steps: 500 }
}

describe('playing a group stage through the live queue', () => {
  const shapes = [[3, 3], [3, 3, 3], [4, 4], [4, 4, 4], [5, 4, 4, 4], [5, 5], [6, 6], [3, 3, 3, 3], [4, 3], [5, 3, 3]]

  it('never double-books a player and never gets stuck', () => {
    const failures: string[] = []
    for (const shape of shapes) {
      for (const tables of [1, 2, 3, 4]) {
        for (let seed = 1; seed <= 25; seed++) {
          const { problems } = playThroughQueue(shape, tables, seed)
          if (problems.length) failures.push(`${shape.join('+')} on ${tables} table(s), seed ${seed}: ${problems[0]}`)
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([])
  })

  it('does not get stuck when only one player has matches left (late check-in at the end)', () => {
    const groups = [{ id: 'g0', label: 'A' }]
    const entries = new Map(['a', 'b', 'c', 'late'].map((id) => [id, entry(id)]))
    const base = {
      tournament_id: 't',
      event_id: 'e',
      group_id: 'g0',
      score_a: null,
      score_b: null,
      rubber_results: null,
      winner_entry_id: null,
      outcome: 'normal' as const,
    }
    const done = (id: string, a: string, b: string, minute: number): GroupMatch => ({
      ...base,
      id,
      entry_a_id: a,
      entry_b_id: b,
      status: 'completed',
      completed_at: new Date(1_700_000_000_000 + minute * 60_000).toISOString(),
      score_a: 3,
      score_b: 0,
      winner_entry_id: a,
    })
    const open = (id: string, a: string, order: number): GroupMatch => ({
      ...base,
      id,
      entry_a_id: a,
      entry_b_id: 'late',
      status: 'scheduled',
      queue_order: order,
    })
    const matches: GroupMatch[] = [
      done('m1', 'a', 'b', 1),
      done('m2', 'a', 'c', 2),
      done('m3', 'b', 'c', 3),
      open('l1', 'a', 10),
      open('l2', 'b', 11),
      open('l3', 'c', 12),
    ]
    const played: string[] = []
    for (let step = 0; step < 6; step++) {
      const pending = matches.filter((m) => m.status !== 'completed')
      if (!pending.length) break
      const queue = buildEventMatchQueue({ groups, groupMatches: matches, knockoutMatches: [], entryMap: entries })
      const state = buildEventQueueState(queue.ordered, queue.entryWait, 1)
      const onTable = state.tables[0]!.match
      expect(onTable, `step ${step}: table is empty with ${pending.length} matches left`).toBeTruthy()
      const m = matches.find((x) => x.id === onTable!.matchId)!
      m.status = 'completed'
      m.completed_at = new Date(1_700_000_000_000 + (10 + step) * 60_000).toISOString()
      m.score_a = 3
      m.score_b = 0
      m.winner_entry_id = m.entry_a_id
      played.push(m.id)
    }
    expect(played).toEqual(['l1', 'l2', 'l3'])
  })
})
