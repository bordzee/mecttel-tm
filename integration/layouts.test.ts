import { describe, it } from 'vitest'
import { getStartLayoutOptions } from '../src/lib/groupLayout'
import { validateTournamentStart } from '../src/lib/matchOutcomes'
import type { TournamentConfig } from '../src/types'

const cfg = (advance: number, bracket: 'cross' | 'block' | 'mirror'): TournamentConfig => ({
  advance_count: advance,
  knockout_bracket: bracket,
  set_rules: { group: 5, knockout_early: 5, quarters: 5, semis: 5, finals: 7 },
})

describe('which entry counts can start a division?', () => {
  it('lists unsupported counts', () => {
    const rows: string[] = []
    for (let n = 2; n <= 64; n++) {
      const cells: string[] = []
      for (const adv of [1, 2, 3, 4]) {
        for (const br of ['cross', 'block', 'mirror'] as const) {
          const config = cfg(adv, br)
          const options = getStartLayoutOptions(n, config)
          const ok = options.filter((o) => validateTournamentStart(n, config, o.key).ok)
          cells.push(ok.length ? 'Y' : '-')
        }
      }
      rows.push(`${String(n).padStart(2)} | adv1 ${cells.slice(0, 3).join('')} | adv2 ${cells.slice(3, 6).join('')} | adv3 ${cells.slice(6, 9).join('')} | adv4 ${cells.slice(9, 12).join('')}  (cross/block/mirror)`)
    }
    console.log('\n' + rows.join('\n'))
  })
})
