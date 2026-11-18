import { writeFileSync } from 'node:fs'
import { beforeAll, it } from 'vitest'
import { createTournament, saveGroupMatchResult } from '../src/lib/tournamentService'
import { createDivision, fetchGroupMatches, rememberEvent, signInAdmin, startGroupStage, type DivisionSpec, type Finding } from './helpers'

const findings: Finding[] = []
beforeAll(signInAdmin)

it('creates a playground tournament for manual UI testing', async () => {
  const t = await createTournament({ name: 'UI Playground', venue: 'Playground Hall', start_date: '2026-12-10' })
  const out: Record<string, string> = { tournamentId: t.id }
  const specs: [string, DivisionSpec, boolean, number][] = [
    ['singles', { label: 'PG Singles (12)', type: 'single', category: 'open', entries: 12, advance: 2, tables: 3, seededCount: 4 }, true, 0],
    ['team', { label: 'PG Team (6)', type: 'team', category: 'open', entries: 6, advance: 2, tables: 2, teamFormat: 'SSS', roster: 3 }, false, 0],
    ['doubles', { label: 'PG Doubles (8)', type: 'doubles', category: 'open', entries: 8, advance: 2, tables: 2 }, true, 3],
  ]
  for (const [key, spec, start, play] of specs) {
    const ev = await createDivision(t.id, spec, findings)
    rememberEvent(spec.label, ev.id)
    out[key] = ev.id
    if (start) {
      await startGroupStage(t.id, spec, findings)
      const ms = await fetchGroupMatches(t.id, ev.id)
      for (const m of ms.slice(0, play)) await saveGroupMatchResult(m.id, { score_a: 3, score_b: 1, rubber_results: null, winner_entry_id: m.entry_a_id, outcome: 'normal' })
    }
  }
  writeFileSync('integration/playground.json', JSON.stringify({ ...out, findings }, null, 2))
  console.log(JSON.stringify(out))
})
