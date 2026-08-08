import { FormLabel, SegmentedControl } from './ui/primitives'
import type { KnockoutBracketType } from '../types'

export const KNOCKOUT_BRACKET_OPTIONS: { value: KnockoutBracketType; label: string }[] = [
  { value: 'cross', label: 'Cross' },
  { value: 'block', label: 'Block' },
]

export function KnockoutBracketPicker({
  value,
  onChange,
}: {
  value: KnockoutBracketType
  onChange: (value: KnockoutBracketType) => void
}) {
  return (
    <div className="space-y-2">
      <FormLabel>Knockout bracket</FormLabel>
      <SegmentedControl
        value={value}
        onChange={(knockout_bracket) => onChange(knockout_bracket as KnockoutBracketType)}
        options={KNOCKOUT_BRACKET_OPTIONS}
      />
      <p className="text-xs text-text-steel leading-snug">
        Block requires an even number of groups. Cross works with any group count.
      </p>
    </div>
  )
}
