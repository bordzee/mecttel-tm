import { FormLabel, SegmentedControl } from './ui/primitives'
import type { SetRules } from '../types'

export { normalizeSetRules, formatSetRulesSummary } from '../lib/setRules'

const BEST_OF_357 = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
] as const

const BEST_OF_57 = [
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
] as const

export function SetRulesPicker({
  value,
  onChange,
}: {
  value: SetRules
  onChange: (value: SetRules) => void
}) {
  const patchKnockout = (bestOf: 3 | 5 | 7) => {
    onChange({
      ...value,
      knockout_early: bestOf,
      quarters: bestOf,
      semis: bestOf,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormLabel>Group stage</FormLabel>
        <SegmentedControl
          value={String(value.group)}
          onChange={(v) => onChange({ ...value, group: parseInt(v, 10) as 3 | 5 | 7 })}
          options={[...BEST_OF_357]}
        />
      </div>
      <div className="space-y-2">
        <FormLabel>Knockout stage</FormLabel>
        <SegmentedControl
          value={String(value.knockout_early)}
          onChange={(v) => patchKnockout(parseInt(v, 10) as 3 | 5 | 7)}
          options={[...BEST_OF_357]}
        />
        <p className="text-xs text-text-steel leading-snug">
          Applies to quarterfinals and semifinals.
        </p>
      </div>
      <div className="space-y-2">
        <FormLabel>Finals</FormLabel>
        <SegmentedControl
          value={String(value.finals)}
          onChange={(v) => onChange({ ...value, finals: parseInt(v, 10) as 5 | 7 })}
          options={[...BEST_OF_57]}
        />
      </div>
    </div>
  )
}
