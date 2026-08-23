import { FormLabel, SegmentedControl } from './ui/primitives'
import type { KnockoutBracketType } from '../types'

export const KNOCKOUT_BRACKET_OPTIONS: { value: KnockoutBracketType; label: string }[] = [
  { value: 'cross', label: 'Cross' },
  { value: 'block', label: 'Block' },
  { value: 'mirror', label: 'Mirror' },
]

export function KnockoutBracketPicker({
  value,
  onChange,
  blockDisabled = false,
  evenGroupsRequired = false,
}: {
  value: KnockoutBracketType
  onChange: (value: KnockoutBracketType) => void
  /** @deprecated Use evenGroupsRequired */
  blockDisabled?: boolean
  evenGroupsRequired?: boolean
}) {
  const disableBlockAndMirror = evenGroupsRequired || blockDisabled

  return (
    <div className="space-y-2">
      <FormLabel>Knockout bracket</FormLabel>
      <SegmentedControl
        value={value}
        onChange={(knockout_bracket) => onChange(knockout_bracket as KnockoutBracketType)}
        options={KNOCKOUT_BRACKET_OPTIONS}
        disabledValues={disableBlockAndMirror ? ['block', 'mirror'] : []}
      />
      <p className="text-xs text-text-steel leading-snug">
        Cross works with any group count. Block and mirror require an even number of groups.
      </p>
    </div>
  )
}
