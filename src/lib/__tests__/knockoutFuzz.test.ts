import { describe, expect, it } from 'vitest'
import { generateKnockoutPairings } from '../knockoutSeeding'
import type { KnockoutBracketType, StandingRow, TournamentEntry } from '../../types'

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

function entry(id: string, org: string, seeded: boolean): TournamentEntry {
  return {
    id,
    tournament_id: 't',
    event_id: 'e',
    entry_type: 'player',
    team_id: null,
    player_id: id,
    pair_id: null,
    seeded,
    player: { id, tournament_id: 't', event_id: 'e', name: id, organization: org, seeded },
  }
}

function row(entryId: string, rank: number, wins: number): StandingRow {
  return { entryId, name: entryId, played: 3, wins, losses: 3 - wins, scoreFor: 0, scoreAgainst: 0, diff: 0, rank }
}

describe('knockout seeding fuzz', () => {
  it('always builds a consistent tree that includes every advancer once', () => {
    const failures: string[] = []
    let cases = 0
    for (let seed = 1; seed <= 1500; seed++) {
      const rand = rng(seed)
      const groupCount = 2 + Math.floor(rand() * 15)
      const sizes = Array.from({ length: groupCount }, () => 3 + Math.floor(rand() * 4))
      const advance = 1 + Math.floor(rand() * Math.min(4, Math.min(...sizes)))
      const bracket = (['cross', 'block', 'mirror'] as KnockoutBracketType[])[Math.floor(rand() * 3)]!
      if ((bracket === 'block' || bracket === 'mirror') && groupCount % 2 === 1) continue
      cases++

      const entries = new Map<string, TournamentEntry>()
      const byGroup = new Map<string, StandingRow[]>()
      const groupOrder: string[] = []
      const orgs = ['A', 'B', 'C', 'D', 'E', 'F']
      sizes.forEach((size, gi) => {
        const gid = `g${gi}`
        groupOrder.push(gid)
        const rows: StandingRow[] = []
        for (let r = 0; r < size; r++) {
          const id = `g${gi}p${r}`
          entries.set(id, entry(id, orgs[Math.floor(rand() * orgs.length)]!, r === 0 && rand() < 0.4))
          rows.push(row(id, r + 1, size - 1 - r))
        }
        byGroup.set(gid, rows.slice(0, advance))
      })

      const label = `seed ${seed}: ${groupCount} groups ${sizes.join('+')} adv ${advance} ${bracket}`
      let result: ReturnType<typeof generateKnockoutPairings>
      try {
        result = generateKnockoutPairings(byGroup, groupOrder, entries, advance, bracket)
      } catch (e) {
        failures.push(`${label}: threw ${String(e)}`)
        continue
      }
      const { tree } = result
      const advancers = [...byGroup.values()].flat().map((r) => r.entryId)
      if (!tree.length) {
        failures.push(`${label}: empty tree for ${advancers.length} advancers`)
        continue
      }
      const keys = new Set(tree.map((n) => n.key))
      if (keys.size !== tree.length) failures.push(`${label}: duplicate node keys`)
      for (const n of tree) {
        for (const k of [n.slot.sourceAKey, n.slot.sourceBKey, ...(n.slot.feederSourceKeys ?? [])]) {
          if (k && !keys.has(k)) failures.push(`${label}: dangling source ${k}`)
        }
      }
      const finals = tree.filter((n) => n.slot.round === 'final')
      if (finals.length !== 1) failures.push(`${label}: ${finals.length} finals`)

      const placed = new Map<string, number>()
      for (const n of tree) {
        const ids = new Set([n.slot.entryAId, n.slot.entryBId].filter(Boolean) as string[])
        for (const id of ids) placed.set(id, (placed.get(id) ?? 0) + 1)
      }
      const missing = advancers.filter((id) => !placed.has(id))
      if (missing.length) failures.push(`${label}: advancers missing from the draw: ${missing.slice(0, 3).join(',')}`)
      const repeated = [...placed.entries()].filter(([, c]) => c > 1).map(([id]) => id)
      // an entry may legitimately appear in a first-round slot only once
      if (repeated.length) failures.push(`${label}: entries placed in several slots: ${repeated.slice(0, 3).join(',')}`)
    }
    console.log(`checked ${cases} bracket configurations, ${failures.length} problems`)
    expect(failures.slice(0, 10)).toEqual([])
  })
})
