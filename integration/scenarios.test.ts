import { writeFileSync } from 'node:fs'
import { signOut } from 'firebase/auth'
import { beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/lib/firebaseAuth'
import { deleteDivision, setMasterPassword } from '../src/lib/guardedDelete'
import {
  addLateJoinEntry,
  assignMatchTable,
  createTournament,
  deleteEntry,
  fetchEvents,
  fetchPublicTournaments,
  moveEntryToGroup,
  regenerateKnockoutFromRanks,
  saveGroupMatchResult,
  saveKnockoutMatchResult,
  updateGroupMatchResult,
  updateKnockoutMatchResult,
  fetchTournament,
} from '../src/lib/tournamentService'
import { computeStandings, needsManualRankResolution } from '../src/lib/standings'
import { getBestOfForStage } from '../src/lib/scoring'
import { forfeitScores } from '../src/lib/matchOutcomes'
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

const findings: Finding[] = []
const notes: string[] = []
let tournamentId = ''

beforeAll(async () => {
  await signInAdmin()
  await setMasterPassword('local-master-1-long-enough')
  const t = await createTournament({ name: `Scenarios ${new Date().toISOString().slice(11, 19)}`, venue: 'Sim Hall', start_date: '2026-12-02' })
  tournamentId = t.id
})

async function startedDivision(label: string, entries: number, extra: Partial<DivisionSpec> = {}) {
  const spec: DivisionSpec = { label, type: 'single', category: 'open', entries, advance: 2, tables: 2, ...extra }
  const ev = await createDivision(tournamentId, spec, findings)
  rememberEvent(label, ev.id)
  const start = await startGroupStage(tournamentId, spec, findings)
  if (!start) throw new Error('could not start ' + label)
  return { spec, eventId: ev.id }
}

const f = (division: string, step: string, message: string) => findings.push({ division, step, message })

describe('scenarios', () => {
  it('late join: balance, pick and new group', async () => {
    const { spec, eventId } = await startedDivision('Late join (9)', 9)
    const event = await fetchEvent(tournamentId, eventId)
    let groups = await fetchGroups(tournamentId, eventId)
    const before = (await fetchGroupMatches(tournamentId, eventId)).length
    const rand = rng(7)
    // play a few matches first so late entrants arrive mid-stage
    const ms = await fetchGroupMatches(tournamentId, eventId)
    for (const m of ms.slice(0, 3)) await saveGroupMatchResult(m.id, { score_a: 3, score_b: 1, rubber_results: null, winner_entry_id: m.entry_a_id, outcome: 'normal' })

    const r1 = await addLateJoinEntry(tournamentId, eventId, { type: 'player', name: 'Late Balance', organization: 'X', seeded: null }, { mode: 'balance', groupId: groups[0]!.id })
    const r2 = await addLateJoinEntry(tournamentId, eventId, { type: 'player', name: 'Late Pick', organization: 'X', seeded: null }, { mode: 'pick', groupId: groups[1]!.id })
    const r3 = await addLateJoinEntry(tournamentId, eventId, { type: 'player', name: 'Late NewGroup A', organization: 'X', seeded: null }, { mode: 'new_group' })
    const r4 = await addLateJoinEntry(tournamentId, eventId, { type: 'player', name: 'Late NewGroup B', organization: 'X', seeded: null }, { mode: 'balance', groupId: (await fetchGroups(tournamentId, eventId)).slice(-1)[0]!.id })
    notes.push(`late join warnings: ${JSON.stringify([r1.warnings, r2.warnings, r3.warnings, r4.warnings])}`)
    groups = await fetchGroups(tournamentId, eventId)
    const members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    const entries = await fetchEntries(tournamentId, eventId)
    const matches = await fetchGroupMatches(tournamentId, eventId)
    const sizes = groups.map((g) => members.filter((m) => m.group_id === g.id).length)
    const expected = sizes.reduce((n, s) => n + (s * (s - 1)) / 2, 0)
    if (matches.length !== expected) f(spec.label, 'late join', `matches ${matches.length} != expected ${expected} for sizes ${sizes.join('+')}`)
    if (members.length !== entries.length) f(spec.label, 'late join', `members ${members.length} != entries ${entries.length}`)
    // every pair in a group has exactly one match
    for (const g of groups) {
      const ids = members.filter((m) => m.group_id === g.id).map((m) => m.entry_id)
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const c = matches.filter((m) => m.group_id === g.id && ((m.entry_a_id === ids[i] && m.entry_b_id === ids[j]) || (m.entry_a_id === ids[j] && m.entry_b_id === ids[i]))).length
        if (c !== 1) f(spec.label, 'late join', `group ${g.label}: pair has ${c} matches`)
      }
    }
    notes.push(`late join: sizes ${sizes.join('+')} (was ${before} matches, now ${matches.length})`)
    // finish the stage and knockout with the odd groups (incl. a group of 2)
    const strength = new Map(entries.map((e) => [e.id, 0.2 + rand()]))
    await playGroupStage(tournamentId, eventId, spec, rand, findings, strength)
    await resolveTies(tournamentId, eventId, spec, findings, true)
    try {
      await generateKnockoutBracket(tournamentId, await fetchEvent(tournamentId, eventId))
      await playKnockout(tournamentId, eventId, spec, rand, findings, strength)
      const ko = await fetchKnockoutMatches(tournamentId, eventId)
      if (!ko.find((m) => m.round === 'final')?.winner_entry_id) f(spec.label, 'late join', 'no champion after late joins')
    } catch (e) {
      f(spec.label, 'late join knockout', String(e))
    }
    void event
  })

  it('move entry and delete entry mid-stage', async () => {
    const { spec, eventId } = await startedDivision('Move/delete (12)', 12)
    const groups = await fetchGroups(tournamentId, eventId)
    let members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    const entries = await fetchEntries(tournamentId, eventId)
    const mover = entries.find((e) => e.id === members.find((m) => m.group_id === groups[0]!.id)!.entry_id)!
    try {
      const res = await moveEntryToGroup(tournamentId, eventId, mover.id, groups[1]!.id)
      notes.push(`move warnings: ${JSON.stringify(res.warnings)}`)
    } catch (e) {
      f(spec.label, 'moveEntryToGroup (no matches played)', String(e))
    }
    members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    const matches = await fetchGroupMatches(tournamentId, eventId)
    const g1 = members.filter((m) => m.group_id === groups[1]!.id).length
    const moved = matches.filter((m) => m.entry_a_id === mover.id || m.entry_b_id === mover.id)
    if (moved.length !== g1 - 1) f(spec.label, 'move', `moved entry has ${moved.length} matches, expected ${g1 - 1}`)
    if (moved.some((m) => m.group_id !== groups[1]!.id)) f(spec.label, 'move', 'moved entry still has matches in the old group')

    // play a match involving the mover, then try moving again (should be blocked or warn)
    const played = moved[0]!
    await saveGroupMatchResult(played.id, { score_a: 3, score_b: 0, rubber_results: null, winner_entry_id: played.entry_a_id, outcome: 'normal' })
    try {
      await moveEntryToGroup(tournamentId, eventId, mover.id, groups[2]!.id)
      f(spec.label, 'move after playing', 'moving a player who already played was allowed; results of the old group vanish silently?')
    } catch (e) {
      notes.push(`move after playing blocked: ${String(e).slice(0, 120)}`)
    }
    // delete an entry who has a completed match
    const opp = played.entry_a_id === mover.id ? played.entry_b_id : played.entry_a_id
    const oppEntry = (await fetchEntries(tournamentId, eventId)).find((e) => e.id === opp)!
    const beforeMatches = (await fetchGroupMatches(tournamentId, eventId)).filter((m) => m.status === 'completed').length
    try {
      await deleteEntry(oppEntry)
    } catch (e) {
      f(spec.label, 'deleteEntry', String(e))
    }
    const afterMatches = (await fetchGroupMatches(tournamentId, eventId)).filter((m) => m.status === 'completed').length
    notes.push(`delete entry who had a completed match: completed matches ${beforeMatches} -> ${afterMatches} (the opponent's win vanished)`)
    const e2 = await fetchEntries(tournamentId, eventId)
    const m2 = await fetchGroupMatches(tournamentId, eventId)
    const orphan = m2.filter((m) => !e2.some((e) => e.id === m.entry_a_id) || !e2.some((e) => e.id === m.entry_b_id))
    if (orphan.length) f(spec.label, 'deleteEntry', `${orphan.length} matches reference a deleted entry`)
    const ge = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    if (ge.some((m) => !e2.some((e) => e.id === m.entry_id))) f(spec.label, 'deleteEntry', 'group_members reference a deleted entry')
  })

  it('forfeit, no-show and DQ outcomes feed standings correctly', async () => {
    const { spec, eventId } = await startedDivision('Outcomes (6)', 6)
    const event = await fetchEvent(tournamentId, eventId)
    const bestOf = getBestOfForStage('group', event.config)
    const matches = await fetchGroupMatches(tournamentId, eventId)
    const outcomes = ['forfeit', 'no_show', 'dq'] as const
    for (const [i, outcome] of outcomes.entries()) {
      const m = matches[i]!
      const s = forfeitScores(false, undefined, bestOf)
      // admin picks entry B as the winner by forfeit: score is A=0, B=wins
      try {
        await saveGroupMatchResult(m.id, { score_a: s.scoreA, score_b: s.scoreB, rubber_results: null, winner_entry_id: m.entry_b_id, outcome })
      } catch (e) {
        f(spec.label, `save ${outcome}`, String(e))
      }
    }
    const done = (await fetchGroupMatches(tournamentId, eventId)).filter((m) => m.status === 'completed')
    if (done.length !== 3) f(spec.label, 'outcomes', `expected 3 completed, got ${done.length}`)
    const groups = await fetchGroups(tournamentId, eventId)
    const members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    const entries = await fetchEntries(tournamentId, eventId)
    const map = new Map(entries.map((e) => [e.id, e]))
    for (const g of groups) {
      const ids = members.filter((m) => m.group_id === g.id).map((m) => m.entry_id)
      const rows = computeStandings(ids, done.filter((m) => m.group_id === g.id), map)
      for (const r of rows) if (r.wins + r.losses !== r.played) f(spec.label, 'standings', `${r.name}: W+L != played`)
    }
  })

  it('knockout cannot be generated while ties are unresolved, even irrelevant ones', async () => {
    // 4 groups of 3 with adv=1: every group is a 3-way cycle = unavoidable full tie
    const { spec, eventId } = await startedDivision('Ties (12, adv 1)', 12, { advance: 1 })
    const ms = await fetchGroupMatches(tournamentId, eventId)
    const groups = await fetchGroups(tournamentId, eventId)
    // make group A a perfect cycle a>b, b>c, c>a with identical set scores, others normal
    for (const g of groups) {
      const gm = ms.filter((m) => m.group_id === g.id)
      for (const [i, m] of gm.entries()) {
        const aWins = g === groups[0] ? i !== 2 : true
        await saveGroupMatchResult(m.id, {
          score_a: aWins ? 3 : 1,
          score_b: aWins ? 1 : 3,
          rubber_results: null,
          winner_entry_id: aWins ? m.entry_a_id : m.entry_b_id,
          outcome: 'normal',
        })
      }
    }
    try {
      await generateKnockoutBracket(tournamentId, await fetchEvent(tournamentId, eventId))
      notes.push('generateKnockoutBracket succeeded with a full-cycle group')
    } catch (e) {
      notes.push(`generateKnockoutBracket with a group tie: ${String(e)}`)
      f(spec.label, 'ties', `a tied group blocks bracket generation until ranks are set manually: ${String(e)}`)
    }
    void spec
  })

  it('two admins scoring the same match: the second save must fail', async () => {
    const { eventId } = await startedDivision('Concurrent scoring (6)', 6)
    const m = (await fetchGroupMatches(tournamentId, eventId))[0]!
    const a = saveGroupMatchResult(m.id, { score_a: 3, score_b: 0, rubber_results: null, winner_entry_id: m.entry_a_id, outcome: 'normal' })
    const b = saveGroupMatchResult(m.id, { score_a: 0, score_b: 3, rubber_results: null, winner_entry_id: m.entry_b_id, outcome: 'normal' })
    const results = await Promise.allSettled([a, b])
    const ok = results.filter((r) => r.status === 'fulfilled').length
    notes.push(`concurrent saves: ${ok} succeeded, ${results.length - ok} rejected`)
    if (ok !== 1) f('Concurrent scoring', 'transaction', `expected exactly one winner of the race, got ${ok}`)
    const final = (await fetchGroupMatches(tournamentId, eventId)).find((x) => x.id === m.id)!
    if (final.status !== 'completed') f('Concurrent scoring', 'transaction', 'match not completed')
  })

  it('invalid scores are rejected', async () => {
    const { eventId } = await startedDivision('Invalid scores (6)', 6)
    const m = (await fetchGroupMatches(tournamentId, eventId))[0]!
    const bad = [
      { score_a: 3, score_b: 3, winner_entry_id: m.entry_a_id },
      { score_a: 2, score_b: 1, winner_entry_id: m.entry_a_id },
      { score_a: 4, score_b: 0, winner_entry_id: m.entry_a_id },
      { score_a: 3, score_b: 1, winner_entry_id: 'not-an-entry' },
      { score_a: 1, score_b: 3, winner_entry_id: m.entry_a_id },
      { score_a: -3, score_b: 0, winner_entry_id: m.entry_a_id },
    ]
    for (const [i, p] of bad.entries()) {
      try {
        await saveGroupMatchResult(m.id, { ...p, rubber_results: null, outcome: 'normal' })
        f('Invalid scores', `case ${i}`, `accepted ${JSON.stringify(p)}`)
      } catch {
        // expected
      }
    }
  })

  it('editing results after the bracket exists', async () => {
    const { spec, eventId } = await startedDivision('Edits after bracket (8)', 8)
    const rand = rng(11)
    const entries = await fetchEntries(tournamentId, eventId)
    const strength = new Map(entries.map((e) => [e.id, 0.2 + rand()]))
    await playGroupStage(tournamentId, eventId, spec, rand, findings, strength)
    await resolveTies(tournamentId, eventId, spec, findings, true)
    await generateKnockoutBracket(tournamentId, await fetchEvent(tournamentId, eventId))
    // edit a group score before knockout scoring begins
    const gm = (await fetchGroupMatches(tournamentId, eventId))[0]!
    try {
      const r = await updateGroupMatchResult(gm.id, { score_a: gm.score_b!, score_b: gm.score_a!, rubber_results: null, winner_entry_id: gm.winner_entry_id === gm.entry_a_id ? gm.entry_b_id : gm.entry_a_id, outcome: 'normal' })
      notes.push(`group edit warnings: ${JSON.stringify(r.warnings)}`)
    } catch (e) {
      f(spec.label, 'edit group score', String(e))
    }
    try {
      await regenerateKnockoutFromRanks(tournamentId, eventId)
    } catch (e) {
      notes.push(`regenerate after edit: ${String(e).slice(0, 200)}`)
      f(spec.label, 'regenerate after edit', String(e))
    }
    // knockout: score semis, then try editing a semi after the final is scored
    await playKnockout(tournamentId, eventId, spec, rand, findings, strength)
    const ko = await fetchKnockoutMatches(tournamentId, eventId)
    const semi = ko.find((m) => m.round === 'semi' && m.status === 'completed')
    if (semi) {
      try {
        await updateKnockoutMatchResult(semi.id, { score_a: semi.score_b!, score_b: semi.score_a!, rubber_results: null, winner_entry_id: semi.winner_entry_id === semi.entry_a_id ? semi.entry_b_id! : semi.entry_a_id!, outcome: 'normal' }, 'semis')
        f(spec.label, 'edit semi after final', 'allowed editing a semifinal after the final was scored')
      } catch (e) {
        notes.push(`edit semi after final blocked: ${String(e).slice(0, 100)}`)
      }
    }
    try {
      await regenerateKnockoutFromRanks(tournamentId, eventId)
      f(spec.label, 'regenerate after scoring', 'regenerating the bracket after knockout scores exist was allowed')
    } catch (e) {
      notes.push(`regenerate after knockout scored blocked: ${String(e).slice(0, 100)}`)
    }
  })

  it('table pins and public visibility', async () => {
    const { eventId } = await startedDivision('Tables (6)', 6)
    const m = (await fetchGroupMatches(tournamentId, eventId))[0]!
    await assignMatchTable('group', m.id, 2)
    const pinned = (await fetchGroupMatches(tournamentId, eventId)).find((x) => x.id === m.id)!
    if (pinned.assigned_table !== 2) f('Tables', 'assignMatchTable', 'pin not stored')
    // public (signed-out) reads
    await signOut(auth)
    try {
      const pub = await fetchPublicTournaments()
      const mine = pub.find((t) => t.id === tournamentId)
      if (!mine) f('Public', 'visibility', 'tournament with ongoing divisions is not visible to the public')
      const ev = await fetchEvent(tournamentId, eventId)
      if (ev.status !== 'ongoing') f('Public', 'visibility', 'event not readable/ongoing for anon')
      const gms = await fetchGroupMatches(tournamentId, eventId)
      if (!gms.length) f('Public', 'visibility', 'anon cannot read group matches')
      const members = await fetchGroupMembers(tournamentId, eventId, (await fetchGroups(tournamentId, eventId)).map((g) => g.id))
      if (!members.length) f('Public', 'visibility', 'anon cannot read group members')
      try {
        await saveGroupMatchResult(m.id, { score_a: 3, score_b: 0, rubber_results: null, winner_entry_id: m.entry_a_id, outcome: 'normal' })
        f('Public', 'security', 'an anonymous client was able to save a score')
      } catch {
        // expected
      }
    } catch (e) {
      f('Public', 'reads', String(e))
    } finally {
      await signInAdmin()
    }
  })

  it('draft/upcoming divisions are hidden; delete division cleans up', async () => {
    const spec: DivisionSpec = { label: 'Cleanup (6)', type: 'single', category: 'open', entries: 6, advance: 2 }
    const ev = await createDivision(tournamentId, spec, findings)
    rememberEvent(spec.label, ev.id)
    const events = await fetchEvents(tournamentId)
    notes.push(`events in tournament: ${events.length}`)
    await deleteDivision(tournamentId, ev.id, 'local-master-1-long-enough')
    const entriesLeft = await fetchEntries(tournamentId, ev.id)
    if (entriesLeft.length) f(spec.label, 'deleteEvent', `${entriesLeft.length} entries remain after deleting the division`)
    const t = await fetchTournament(tournamentId)
    void t
  })

  it('seeds are spread across groups and clubs are separated', async () => {
    const { spec, eventId } = await startedDivision('Seeding (17, 4 seeds)', 17, { seededCount: 4, groupCount: 4 })
    const groups = await fetchGroups(tournamentId, eventId)
    const members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
    const entries = await fetchEntries(tournamentId, eventId)
    const seeds = entries.filter((e) => e.seeded)
    const groupOfSeed = seeds.map((e) => members.find((m) => m.entry_id === e.id)!.group_id)
    if (new Set(groupOfSeed).size !== seeds.length) f(spec.label, 'seeding', `4 seeds landed in ${new Set(groupOfSeed).size} distinct groups`)
    const sizes = groups.map((g) => members.filter((m) => m.group_id === g.id).length)
    notes.push(`seeding: group sizes ${sizes.join('+')}, seeds in distinct groups: ${new Set(groupOfSeed).size}/${seeds.length}`)
    const clubs = new Map<string, number>()
    for (const g of groups) {
      const orgs = members.filter((m) => m.group_id === g.id).map((m) => (entries.find((e) => e.id === m.entry_id)!.player as { organization: string | null }).organization)
      const dup = orgs.length - new Set(orgs).size
      clubs.set(g.label, dup)
    }
    notes.push(`same-club pairs per group: ${[...clubs.entries()].map(([k, v]) => k + '=' + v).join(' ')}`)
  })

  it('writes the report', () => {
    writeFileSync('integration/report-scenarios.json', JSON.stringify({ findings, notes }, null, 2))
    console.log('\n=== NOTES ===\n' + notes.join('\n'))
    console.log('\n=== FINDINGS (' + findings.length + ') ===\n' + findings.map((x) => `[${x.division}] ${x.step}: ${x.message}`).join('\n'))
    expect(true).toBe(true)
  })
})
void needsManualRankResolution
void saveKnockoutMatchResult
void matchEffectiveRound
void setRulesStageForRound
