import { writeFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTournament } from '../src/lib/tournamentService'
import { buildEventMatchQueue } from '../src/lib/matchQueue'
import { buildEventQueueState } from '../src/lib/tableAssignment'
import { getBestOfForStage } from '../src/lib/scoring'
import { matchEffectiveRound } from '../src/lib/knockoutTabs'
import { setRulesStageForRound } from '../src/lib/knockoutRounds'
import {
  type DivisionSpec,
  type Finding,
  createDivision,
  fetchEntries,
  fetchEvent,
  fetchGroupMatches,
  fetchGroupMembers,
  fetchGroups,
  fetchKnockoutMatches,
  generateKnockoutBracket,
  playGroupStage,
  playKnockout,
  rememberEvent,
  resolveTies,
  rng,
  signInAdmin,
  startGroupStage,
} from './helpers'
import { saveGroupMatchResult, saveKnockoutMatchResult } from '../src/lib/tournamentService'

const findings: Finding[] = []
const summaries: Record<string, unknown>[] = []

const SPECS: DivisionSpec[] = [
  { label: 'Singles U12 (12)', type: 'single', category: 'u12', entries: 12, advance: 2, tables: 2 },
  { label: 'Singles Open (17, mirror)', type: 'single', category: 'open', entries: 17, advance: 2, tables: 3, bracket: 'mirror', seededCount: 4, groupCount: 4 },
  { label: 'Doubles Open (10)', type: 'doubles', category: 'open', entries: 10, advance: 2, tables: 2 },
  { label: 'Team SSS (9)', type: 'team', category: 'open', entries: 9, advance: 2, tables: 2, teamFormat: 'SSS', roster: 3 },
  { label: 'Team SSDSS (8)', type: 'team', category: 'open', entries: 8, advance: 2, tables: 2, teamFormat: 'SSDSS', roster: 4 },
  { label: 'Executive (8)', type: 'executive', category: null, entries: 8, advance: 2, tables: 1 },
  { label: 'Singles U16 (6, min size)', type: 'single', category: 'u16', entries: 6, advance: 2, tables: 1 },
  { label: 'Singles U18 (5)', type: 'single', category: 'u18', entries: 5, advance: 2, tables: 1, expectUnstartable: true },
  { label: 'Singles (4)', type: 'single', category: 'open', entries: 4, advance: 2, tables: 1, expectUnstartable: true },
  { label: 'Singles (3)', type: 'single', category: 'open', entries: 3, advance: 1, tables: 1, expectUnstartable: true },
  { label: 'Singles (2)', type: 'single', category: 'open', entries: 2, advance: 1, tables: 1, expectUnstartable: true },
  { label: 'Singles adv=3 (16)', type: 'single', category: 'open', entries: 16, advance: 3, tables: 4 },
  { label: 'Singles adv=4 block (16)', type: 'single', category: 'open', entries: 16, advance: 4, tables: 4, bracket: 'block' },
  { label: 'Singles best-of 3/7 (12)', type: 'single', category: 'open', entries: 12, advance: 2, tables: 2, bestOf: { group: 3, knockout_early: 3, quarters: 5, semis: 7, finals: 7 } },
  { label: 'Singles (36, mirror)', type: 'single', category: 'open', entries: 36, advance: 2, tables: 6, bracket: 'mirror', seededCount: 8 },
]

const ONLY = process.env.SIM_ONLY ? process.env.SIM_ONLY.split('|') : null

let tournamentId = ''

beforeAll(async () => {
  await signInAdmin()
  const t = await createTournament({ name: `Simulation ${new Date().toISOString().slice(11, 19)}`, venue: 'Sim Hall', start_date: '2026-12-01' })
  tournamentId = t.id
})

async function queueDrivenGroupPlay(spec: DivisionSpec, eventId: string, rand: () => number, strength: Map<string, number>) {
  let iterations = 0
  let stalls = 0
  let maxParallel = 0
  while (iterations < 400) {
    iterations++
    const [groups, gm, km, entries, event] = await Promise.all([
      fetchGroups(tournamentId, eventId),
      fetchGroupMatches(tournamentId, eventId),
      fetchKnockoutMatches(tournamentId, eventId),
      fetchEntries(tournamentId, eventId),
      fetchEvent(tournamentId, eventId),
    ])
    const pending = gm.filter((m) => m.status !== 'completed')
    if (!pending.length) break
    const entryMap = new Map(entries.map((e) => [e.id, e]))
    const q = buildEventMatchQueue({ groups: groups.map((g) => ({ id: g.id, label: g.label })), groupMatches: gm, knockoutMatches: km, entryMap })
    const state = buildEventQueueState(q.ordered, q.entryWait, event.config.table_count)
    const onTables = state.tables.filter((t) => t.match)
    maxParallel = Math.max(maxParallel, onTables.length)
    // invariants: nobody on two tables at once
    const seen = new Set<string>()
    for (const t of onTables) {
      for (const id of [t.match!.entryAId, t.match!.entryBId]) {
        if (seen.has(id)) findings.push({ division: spec.label, step: 'queue', message: `entry ${id} is on two tables at once (iteration ${iterations})` })
        seen.add(id)
      }
    }
    if (!onTables.length) {
      stalls++
      findings.push({ division: spec.label, step: 'queue', message: `queue stalled with ${pending.length} pending matches and no table filled (iteration ${iterations})` })
      break
    }
    // finish the first table's match (like an organizer entering a score), leave others running
    const target = onTables[Math.floor(rand() * onTables.length)]!.match!
    const m = gm.find((x) => x.id === target.matchId)!
    const bestOf = getBestOfForStage('group', event.config)
    const need = (bestOf + 1) / 2
    const a = m.entry_a_id
    const b = m.entry_b_id
    const pa = (strength.get(a) ?? 0.5) / ((strength.get(a) ?? 0.5) + (strength.get(b) ?? 0.5))
    const aWins = rand() < pa
    const loser = Math.floor(rand() * need)
    try {
      if (spec.type === 'team') {
        const { calculateTieFromRubbers } = await import('../src/lib/scoring')
        const fmt = spec.teamFormat ?? 'SSS'
        const th = fmt === 'SSDSS' ? 3 : 2
        const home: ('W' | 'L')[] = []
        let wa = 0
        let wb = 0
        while (wa < th && wb < th) {
          const t = aWins ? rand() < 0.7 : rand() < 0.3
          home.push(t ? 'W' : 'L')
          if (t) wa++
          else wb++
        }
        const c = calculateTieFromRubbers(home, fmt)
        await saveGroupMatchResult(m.id, { score_a: c.scoreA, score_b: c.scoreB, rubber_results: { home }, winner_entry_id: c.scoreA > c.scoreB ? a : b, outcome: 'normal' })
      } else {
        await saveGroupMatchResult(m.id, { score_a: aWins ? need : loser, score_b: aWins ? loser : need, rubber_results: null, winner_entry_id: aWins ? a : b, outcome: 'normal' })
      }
    } catch (e) {
      findings.push({ division: spec.label, step: 'queue save', message: String(e) })
      break
    }
  }
  return { iterations, stalls, maxParallel }
}

async function queueDrivenKnockout(spec: DivisionSpec, eventId: string, rand: () => number, strength: Map<string, number>) {
  let iterations = 0
  let maxParallel = 0
  while (iterations < 200) {
    iterations++
    const [groups, gm, km, entries, event] = await Promise.all([
      fetchGroups(tournamentId, eventId),
      fetchGroupMatches(tournamentId, eventId),
      fetchKnockoutMatches(tournamentId, eventId),
      fetchEntries(tournamentId, eventId),
      fetchEvent(tournamentId, eventId),
    ])
    const scorable = km.filter((m) => m.status !== 'completed' && m.entry_a_id && m.entry_b_id && m.outcome !== 'bye')
    if (!scorable.length) break
    const entryMap = new Map(entries.map((e) => [e.id, e]))
    const q = buildEventMatchQueue({ groups: groups.map((g) => ({ id: g.id, label: g.label })), groupMatches: gm, knockoutMatches: km, entryMap })
    const state = buildEventQueueState(q.ordered, q.entryWait, event.config.table_count)
    const onTables = state.tables.filter((t) => t.match)
    maxParallel = Math.max(maxParallel, onTables.length)
    const seen = new Set<string>()
    for (const t of onTables) for (const id of [t.match!.entryAId, t.match!.entryBId]) {
      if (seen.has(id)) findings.push({ division: spec.label, step: 'knockout queue', message: `entry ${id} is on two tables at once` })
      seen.add(id)
    }
    if (!onTables.length) {
      findings.push({ division: spec.label, step: 'knockout queue', message: `stalled: ${scorable.length} scorable matches (${scorable.map((m) => m.round).join(',')}) but no table is filled; phase=${q.phase}` })
      return { iterations, stalled: true, maxParallel }
    }
    const target = onTables[Math.floor(rand() * onTables.length)]!.match!
    const m = km.find((x) => x.id === target.matchId)!
    const stage = setRulesStageForRound(matchEffectiveRound(m, km))
    const need = (getBestOfForStage(stage, event.config) + 1) / 2
    const a = m.entry_a_id!
    const b = m.entry_b_id!
    const aWins = rand() < (strength.get(a) ?? 0.5) / ((strength.get(a) ?? 0.5) + (strength.get(b) ?? 0.5))
    const loser = Math.floor(rand() * need)
    try {
      if (spec.type === 'team') {
        const { calculateTieFromRubbers } = await import('../src/lib/scoring')
        const fmt = spec.teamFormat ?? 'SSS'
        const th = fmt === 'SSDSS' ? 3 : 2
        const home: ('W' | 'L')[] = []
        let wa = 0
        let wb = 0
        while (wa < th && wb < th) {
          const t = aWins ? rand() < 0.7 : rand() < 0.3
          home.push(t ? 'W' : 'L')
          if (t) wa++
          else wb++
        }
        const c = calculateTieFromRubbers(home, fmt)
        await saveKnockoutMatchResult(m.id, { score_a: c.scoreA, score_b: c.scoreB, rubber_results: { home }, winner_entry_id: c.scoreA > c.scoreB ? a : b, outcome: 'normal' }, stage)
      } else {
        await saveKnockoutMatchResult(m.id, { score_a: aWins ? need : loser, score_b: aWins ? loser : need, rubber_results: null, winner_entry_id: aWins ? a : b, outcome: 'normal' }, stage)
      }
    } catch (e) {
      findings.push({ division: spec.label, step: 'knockout queue save', message: String(e) })
      break
    }
  }
  return { iterations, stalled: false, maxParallel }
}

describe('full tournament simulation', () => {
  for (const [idx, spec] of SPECS.entries()) {
    if (ONLY && !ONLY.some((o) => spec.label.includes(o))) continue
    it(spec.label, async () => {
      const rand = rng(1000 + idx)
      const before = findings.length
      const summary: Record<string, unknown> = { division: spec.label }
      const event = await createDivision(tournamentId, spec, findings)
      rememberEvent(spec.label, event.id)
      const start = await startGroupStage(tournamentId, spec, findings)
      summary.layout = start ? start.option.label : null
      if (!start) {
        summaries.push({ ...summary, result: 'could not start' })
        return
      }
      const entries = await fetchEntries(tournamentId, event.id)
      const strength = new Map(entries.map((e) => [e.id, 0.2 + rand()]))
      const groups = await fetchGroups(tournamentId, event.id)
      const gms = await fetchGroupMatches(tournamentId, event.id)
      summary.groups = groups.length
      summary.groupMatches = gms.length
      const members = await fetchGroupMembers(tournamentId, event.id, groups.map((g) => g.id))
      const perGroup = groups.map((g) => members.filter((m) => m.group_id === g.id).length)
      summary.groupSizes = perGroup.join('+')
      const expectedMatches = perGroup.reduce((n, s) => n + (s * (s - 1)) / 2, 0)
      if (gms.length !== expectedMatches) findings.push({ division: spec.label, step: 'groups', message: `expected ${expectedMatches} round-robin matches, found ${gms.length}` })
      if (members.length !== entries.length) findings.push({ division: spec.label, step: 'groups', message: `members ${members.length} != entries ${entries.length}` })

      // half the divisions are played through the live queue, the rest in bulk
      if (idx % 2 === 0) summary.queue = await queueDrivenGroupPlay(spec, event.id, rand, strength)
      else await playGroupStage(tournamentId, event.id, spec, rand, findings, strength)
      const stillPending = (await fetchGroupMatches(tournamentId, event.id)).filter((m) => m.status !== 'completed').length
      summary.pendingAfterGroups = stillPending
      if (stillPending) findings.push({ division: spec.label, step: 'groups', message: `${stillPending} group matches never completed` })

      summary.ties = await resolveTies(tournamentId, event.id, spec, findings, true)
      const fresh = await fetchEvent(tournamentId, event.id)
      try {
        const warnings = await generateKnockoutBracket(tournamentId, fresh)
        summary.knockoutWarnings = warnings
      } catch (e) {
        findings.push({ division: spec.label, step: 'generateKnockoutBracket', message: String(e) })
        summaries.push({ ...summary, result: 'knockout failed' })
        return
      }
      const ko0 = await fetchKnockoutMatches(tournamentId, event.id)
      summary.knockoutMatches = ko0.length
      summary.byes = ko0.filter((m) => m.outcome === 'bye').length
      {
        const finals = ko0.filter((m) => m.round === 'final')
        if (ko0.length && finals.length !== 1) findings.push({ division: spec.label, step: 'bracket', message: `expected exactly one final, found ${finals.length}` })
        for (const m of ko0) {
          const eff = matchEffectiveRound(m, ko0)
          if ((m.round === 'final' || m.round === 'third_place') && eff !== m.round) findings.push({ division: spec.label, step: 'bracket', message: `${m.round} match is treated as ${eff}` })
        }
        const fin = finals[0]
        if (fin) {
          const stage = setRulesStageForRound(matchEffectiveRound(fin, ko0))
          if (stage !== 'finals') findings.push({ division: spec.label, step: 'bracket', message: `final would be scored with ${stage} rules` })
        }
      }
      if (idx % 2 === 1) summary.knockoutQueue = await queueDrivenKnockout(spec, event.id, rand, strength)
      else summary.knockoutPasses = await playKnockout(tournamentId, event.id, spec, rand, findings, strength)
      const ko = await fetchKnockoutMatches(tournamentId, event.id)
      const unfinished = ko.filter((m) => m.status !== 'completed')
      if (unfinished.length) findings.push({ division: spec.label, step: 'knockout', message: `${unfinished.length} knockout matches unfinished: ${unfinished.map((m) => `${m.round}#${m.slot}:${m.status}`).join(',')}` })
      const final = ko.find((m) => m.round === 'final')
      summary.champion = final?.winner_entry_id ?? null
      if (ko.length && !final?.winner_entry_id) findings.push({ division: spec.label, step: 'knockout', message: 'no champion decided' })
      // each entry appears at most once per round
      const byRound = new Map<string, string[]>()
      for (const m of ko) {
        if (m.outcome === 'bye') continue
        const arr = byRound.get(m.round) ?? []
        for (const id of [m.entry_a_id, m.entry_b_id]) if (id) arr.push(id)
        byRound.set(m.round, arr)
      }
      for (const [round, ids] of byRound) {
        if (round === 'third_place') continue
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
        if (dupes.length) findings.push({ division: spec.label, step: 'knockout', message: `entries repeated in ${round}: ${dupes.join(',')}` })
      }
      summary.newFindings = findings.length - before
      summaries.push(summary)
    })
  }

  it('writes the report', () => {
    writeFileSync('integration/report.json', JSON.stringify({ findings, summaries }, null, 2))
    console.log('\n=== SUMMARIES ===\n' + summaries.map((s) => JSON.stringify(s)).join('\n'))
    console.log('\n=== FINDINGS (' + findings.length + ') ===\n' + findings.map((f) => `[${f.division}] ${f.step}: ${f.message}`).join('\n'))
    expect(true).toBe(true)
  })
})
