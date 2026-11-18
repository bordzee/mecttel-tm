import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../src/lib/firebaseAuth'
import {
  addPairEntry,
  addPlayerEntry,
  addTeamEntry,
  createEvent,
  fetchEntries,
  fetchGroupMatches,
  fetchGroupMembers,
  fetchGroups,
  fetchKnockoutMatches,
  generateGroupStage,
  generateKnockoutBracket,
  saveGroupMatchResult,
  saveGroupRankOrder,
  saveKnockoutMatchResult,
  fetchEvent,
} from '../src/lib/tournamentService'
import { assignEntriesToGroups } from '../src/lib/groupAssignment'
import { getStartLayoutOptions } from '../src/lib/groupLayout'
import { validateTournamentStart } from '../src/lib/matchOutcomes'
import { calculateTieFromRubbers, getBestOfForStage } from '../src/lib/scoring'
import { matchEffectiveRound } from '../src/lib/knockoutTabs'
import { setRulesStageForRound } from '../src/lib/knockoutRounds'
import { computeStandings, needsManualRankResolution } from '../src/lib/standings'
import type { EventType, Category, TournamentConfig, TournamentEntry, TeamFormat, GroupMatch, KnockoutMatch, RubberResult } from '../src/types'

export async function signInAdmin() {
  await signInWithEmailAndPassword(auth, 'admin@example.test', 'emulator-pass-1')
}

/** A normal (non-super) admin created by the seed script. */
export async function signInPlainAdmin() {
  await signInWithEmailAndPassword(auth, 'plain.admin@example.test', 'emulator-pass-1')
}

/** Deterministic PRNG so a failing run can be replayed. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DivisionSpec {
  label: string
  type: EventType
  category: Category | null
  entries: number
  advance: number
  tables?: number
  bracket?: 'cross' | 'block' | 'mirror'
  teamFormat?: TeamFormat
  roster?: 3 | 4
  seededCount?: number
  bestOf?: { group: 3 | 5 | 7; knockout_early: 3 | 5 | 7; quarters: 3 | 5 | 7; semis: 3 | 5 | 7; finals: 5 | 7 }
  layoutIndex?: number
  /** Pick the layout with exactly this many groups. */
  groupCount?: number
  /** Fewer than 6 entries cannot start (two groups of 3 is the minimum); that is expected. */
  expectUnstartable?: boolean
}

export interface Finding {
  division: string
  step: string
  message: string
}

const FIRST = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Lia', 'Mo', 'Nia', 'Omar', 'Pia', 'Quin', 'Ria', 'Sol', 'Tao', 'Uma', 'Vik', 'Wen', 'Xia', 'Yan', 'Zed']
const LAST = ['Reyes', 'Tanaka', 'Okafor', 'Novak', 'Silva', 'Haddad', 'Larsen', 'Moreau', 'Singh', 'Park', 'Ruiz', 'Weber', 'Costa', 'Ivanov', 'Nguyen', 'Cohen']
const CLUBS = ['Quezon TTC', 'Osaka Rally', 'Lagos Spin', 'Porto Pong', 'Cebu Paddlers', 'Kazan TT', 'Pune Paddlers', 'Lyon Club']

export function playerName(i: number) {
  return `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}${i >= FIRST.length * LAST.length ? i : ''}`
}

export async function createDivision(tournamentId: string, spec: DivisionSpec, findings: Finding[]) {
  const config: TournamentConfig = {
    advance_count: spec.advance,
    set_rules: spec.bestOf ?? { group: 5, knockout_early: 5, quarters: 5, semis: 5, finals: 7 },
    table_count: spec.tables ?? 2,
    knockout_bracket: spec.bracket ?? 'cross',
    ...(spec.type === 'team' ? { team_format: spec.teamFormat ?? 'SSS', roster_size: spec.roster ?? 3 } : {}),
  }
  const event = await createEvent(tournamentId, {
    name: spec.label,
    event_type: spec.type,
    category: spec.category,
    config,
    status: 'upcoming',
  })
  for (let i = 0; i < spec.entries; i++) {
    const seeded = i < (spec.seededCount ?? 0) ? true : null
    const org = CLUBS[i % CLUBS.length]!
    try {
      if (spec.type === 'team') {
        const roster = Array.from({ length: spec.roster ?? 3 }, (_, r) => playerName(i * 10 + r + 100))
        await addTeamEntry(tournamentId, event.id, { name: `${org} ${i + 1}`, organization: org, seeded, roster })
      } else if (spec.type === 'doubles') {
        await addPairEntry(tournamentId, event.id, {
          pair_name: '',
          player_a: playerName(i * 2),
          player_b: playerName(i * 2 + 1 + 200),
          organization: org,
          seeded,
        })
      } else {
        await addPlayerEntry(tournamentId, event.id, { name: playerName(i), organization: org, seeded })
      }
    } catch (e) {
      findings.push({ division: spec.label, step: `add entry ${i + 1}`, message: String(e) })
    }
  }
  return fetchEvent(tournamentId, event.id)
}

export async function startGroupStage(tournamentId: string, spec: DivisionSpec, findings: Finding[]) {
  const event = await fetchEvent(tournamentId, (await currentEventId(tournamentId, spec.label))!)
  const entries = await fetchEntries(tournamentId, event.id)
  const options = getStartLayoutOptions(entries.length, event.config)
  if (!options.length) {
    if (!spec.expectUnstartable) findings.push({ division: spec.label, step: 'layout', message: `No group layout available for ${entries.length} entries` })
    return null
  }
  const option = (spec.groupCount != null ? options.find((o) => o.groupCount === spec.groupCount) : undefined) ?? options[Math.min(spec.layoutIndex ?? 0, options.length - 1)]!
  const check = validateTournamentStart(entries.length, event.config, option.key)
  if (!check.ok) {
    findings.push({ division: spec.label, step: 'validateTournamentStart', message: check.error ?? 'not ok' })
    return null
  }
  const assign = assignEntriesToGroups(entries, check.groupCount!, check.groupSizes)
  if (assign.error) {
    findings.push({ division: spec.label, step: 'assignEntriesToGroups', message: assign.error })
    return null
  }
  const { group_sizes: _g, ...base } = event.config
  const updated: TournamentConfig = {
    ...base,
    entries_per_group: check.entriesPerGroup!,
    group_count: check.groupCount!,
    ...(check.groupSizes ? { group_sizes: check.groupSizes } : {}),
  }
  try {
    await generateGroupStage(tournamentId, event, entries, updated)
  } catch (e) {
    findings.push({ division: spec.label, step: 'generateGroupStage', message: String(e) })
    return null
  }
  return { option, groupCount: check.groupCount!, sizes: check.groupSizes }
}

const idByLabel = new Map<string, string>()
export function rememberEvent(label: string, id: string) {
  idByLabel.set(`${label}`, id)
}
async function currentEventId(_t: string, label: string) {
  return idByLabel.get(label)
}

function winnerPayload(match: GroupMatch | KnockoutMatch, spec: DivisionSpec, bestOf: 3 | 5 | 7, rand: () => number, strength: Map<string, number>) {
  const a = match.entry_a_id!
  const b = match.entry_b_id!
  const pa = (strength.get(a) ?? 0.5) / ((strength.get(a) ?? 0.5) + (strength.get(b) ?? 0.5))
  const aWins = rand() < pa
  if (spec.type === 'team') {
    const fmt = spec.teamFormat ?? 'SSS'
    const need = fmt === 'SSDSS' ? 3 : 2
    const max = fmt === 'SSDSS' ? 5 : 3
    const home: RubberResult[] = []
    let wa = 0
    let wb = 0
    while (wa < need && wb < need && home.length < max) {
      const aTakes = aWins ? rand() < 0.7 : rand() < 0.3
      home.push(aTakes ? 'W' : 'L')
      if (aTakes) wa++
      else wb++
    }
    const calc = calculateTieFromRubbers(home, fmt)
    return { score_a: calc.scoreA, score_b: calc.scoreB, rubber_results: { home }, winner_entry_id: calc.scoreA > calc.scoreB ? a : b, outcome: 'normal', calcValid: calc.valid }
  }
  const need = (bestOf + 1) / 2
  const loserSets = Math.floor(rand() * need)
  return {
    score_a: aWins ? need : loserSets,
    score_b: aWins ? loserSets : need,
    rubber_results: null,
    winner_entry_id: aWins ? a : b,
    outcome: 'normal',
    calcValid: true,
  }
}

export async function playGroupStage(tournamentId: string, eventId: string, spec: DivisionSpec, rand: () => number, findings: Finding[], strength: Map<string, number>) {
  const event = await fetchEvent(tournamentId, eventId)
  const matches = await fetchGroupMatches(tournamentId, eventId)
  const bestOf = getBestOfForStage('group', event.config)
  let scored = 0
  for (const m of matches) {
    if (m.status === 'completed') continue
    const p = winnerPayload(m, spec, bestOf, rand, strength)
    if (!p.calcValid) {
      findings.push({ division: spec.label, step: 'sim', message: 'simulator produced invalid team tie' })
      continue
    }
    const { calcValid: _c, ...payload } = p
    try {
      await saveGroupMatchResult(m.id, payload)
      scored++
    } catch (e) {
      findings.push({ division: spec.label, step: `saveGroupMatchResult ${m.id}`, message: String(e) })
    }
  }
  return scored
}

export async function resolveTies(tournamentId: string, eventId: string, spec: DivisionSpec, findings: Finding[], onlyAdvancersMatter: boolean) {
  const groups = await fetchGroups(tournamentId, eventId)
  const members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
  const matches = await fetchGroupMatches(tournamentId, eventId)
  const entries = await fetchEntries(tournamentId, eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const event = await fetchEvent(tournamentId, eventId)
  let tiedGroups = 0
  let irrelevantTies = 0
  for (const g of groups) {
    const ids = members.filter((m) => m.group_id === g.id).map((m) => m.entry_id)
    const rows = computeStandings(ids, matches.filter((m) => m.group_id === g.id), entryMap)
    if (!needsManualRankResolution(rows)) continue
    tiedGroups++
    // does any tie involve the advancement cut line?
    const cut = event.config.advance_count
    const keyOf = (r: (typeof rows)[number]) => `${r.wins}:${r.diff}`
    const tiedKeys = new Set(rows.filter((r) => rows.filter((x) => keyOf(x) === keyOf(r)).length > 1).map(keyOf))
    const relevant = rows.some((r, idx) => tiedKeys.has(keyOf(r)) && rows.some((x, j) => keyOf(x) === keyOf(r) && (idx < cut) !== (j < cut)))
    if (!relevant) irrelevantTies++
    try {
      await saveGroupRankOrder(g.id, rows.map((r) => r.entryId), 'sim: resolved by coin flip', { tournamentId, eventId })
    } catch (e) {
      findings.push({ division: spec.label, step: 'saveGroupRankOrder', message: String(e) })
    }
  }
  void onlyAdvancersMatter
  return { tiedGroups, irrelevantTies, totalGroups: groups.length }
}

export async function playKnockout(tournamentId: string, eventId: string, spec: DivisionSpec, rand: () => number, findings: Finding[], strength: Map<string, number>) {
  const event = await fetchEvent(tournamentId, eventId)
  let rounds = 0
  for (; rounds < 12; rounds++) {
    const all = await fetchKnockoutMatches(tournamentId, eventId)
    const scorable = all.filter((m) => m.status !== 'completed' && m.entry_a_id && m.entry_b_id && m.outcome !== 'bye')
    if (!scorable.length) break
    for (const m of scorable) {
      const stage = setRulesStageForRound(matchEffectiveRound(m, all))
      const bestOf = getBestOfForStage(stage, event.config)
      const p = winnerPayload(m, spec, bestOf, rand, strength)
      const { calcValid: _c, ...payload } = p
      try {
        await saveKnockoutMatchResult(m.id, payload, stage)
      } catch (e) {
        findings.push({ division: spec.label, step: `saveKnockoutMatchResult ${m.round}`, message: String(e) })
      }
    }
  }
  return rounds
}

export { generateKnockoutBracket, fetchKnockoutMatches, fetchGroupMatches, fetchGroups, fetchGroupMembers, fetchEntries, fetchEvent }
export type { TournamentEntry }
