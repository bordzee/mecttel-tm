import { SelectInput } from './ui/primitives'

function seededToSelectValue(seeded: boolean | null | undefined): string {
  if (seeded === true) return 'true'
  if (seeded === false) return 'false'
  return ''
}

function selectValueToSeeded(value: string): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function SeededSelect({
  name = 'seeded',
  value,
  onChange,
}: {
  name?: string
  value?: boolean | null
  onChange?: (value: boolean | null) => void
}) {
  if (onChange) {
    return (
      <SelectInput
        value={seededToSelectValue(value)}
        onChange={(e) => onChange(selectValueToSeeded(e.target.value))}
      >
        <option value="">Seeded — not set</option>
        <option value="true">Seeded — Yes</option>
        <option value="false">Seeded — No</option>
      </SelectInput>
    )
  }

  return (
    <SelectInput name={name} defaultValue="">
      <option value="">Seeded — not set</option>
      <option value="true">Seeded — Yes</option>
      <option value="false">Seeded — No</option>
    </SelectInput>
  )
}

export function seededStatusLabel(entry: {
  seeded?: boolean | null
  team?: { seeded?: boolean | null } | null
  player?: { seeded?: boolean | null } | null
  pair?: { seeded?: boolean | null } | null
}): string {
  const s = entry.seeded ?? entry.team?.seeded ?? entry.player?.seeded ?? entry.pair?.seeded
  if (s === true) return 'Seeded — Yes'
  if (s === false) return 'Seeded — No'
  return 'Seeded — not yet'
}

export function seededLabel(entry: {
  seeded?: boolean | null
  team?: { seeded?: boolean | null } | null
  player?: { seeded?: boolean | null } | null
  pair?: { seeded?: boolean | null } | null
}): string {
  const s = entry.seeded ?? entry.team?.seeded ?? entry.player?.seeded ?? entry.pair?.seeded
  if (s === true) return 'Seeded'
  if (s === false) return 'Unseeded'
  return ''
}
