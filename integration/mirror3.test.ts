import { beforeAll, expect, it } from 'vitest'
import { createTournament, updateEvent } from '../src/lib/tournamentService'
import {
  createDivision, fetchEvent, fetchKnockoutMatches, fetchGroups, generateKnockoutBracket, playGroupStage,
  rememberEvent, resolveTies, rng, signInAdmin, startGroupStage, type DivisionSpec, type Finding,
} from './helpers'

const findings: Finding[] = []
beforeAll(async () => { await signInAdmin() })
it('mirror on 3 groups falls back to cross, says so, and has byes', async () => {
  const t = await createTournament({ name: 'Mirror3 ' + Date.now(), venue: 'Hall', start_date: '2026-12-07' })
  const spec: DivisionSpec = { label: 'Nine-3groups', type: 'single', category: 'open', entries: 9, advance: 2, tables: 2, bracket: 'cross', groupCount: 3 }
  const ev = await createDivision(t.id, spec, findings)
  rememberEvent(spec.label, ev.id)
  const started = await startGroupStage(t.id, spec, findings)
  expect(started?.groupCount).toBe(3)
  // The situation a user can be in: division says mirror but has an odd group count.
  await updateEvent(t.id, ev.id, { config: { ...(await fetchEvent(t.id, ev.id)).config, knockout_bracket: 'mirror' } })
  expect((await fetchEvent(t.id, ev.id)).config.knockout_bracket).toBe('mirror')
  await playGroupStage(t.id, ev.id, spec, rng(3), findings, new Map())
  await resolveTies(t.id, ev.id, spec, findings, true)
  const warnings = await generateKnockoutBracket(t.id, await fetchEvent(t.id, ev.id))
  console.log('WARNINGS', JSON.stringify(warnings))
  const after = await fetchEvent(t.id, ev.id)
  console.log('CONFIG bracket after:', after.config.knockout_bracket)
  const km = await fetchKnockoutMatches(t.id, ev.id)
  const byRound = new Map<string, number>()
  for (const m of km) byRound.set(String(m.round), (byRound.get(String(m.round)) ?? 0) + 1)
  console.log('ROUNDS', JSON.stringify([...byRound]), 'groups', (await fetchGroups(t.id, ev.id)).length)
  console.log('R1', km.filter((m) => m.round === 'quarterfinal' || m.round === 'quarter').map((m) => `${m.entry_a_id ? 'A' : '-'}v${m.entry_b_id ? 'B' : '-'}:${m.status}`).join(' '))
  expect(after.config.knockout_bracket).toBe('cross')
  expect(JSON.stringify(warnings)).toContain('cross')
  expect(findings).toEqual([])
})
