import { SelectInput } from './ui/primitives'

export function SeededSelect({ name = 'seeded' }: { name?: string }) {
  return (
    <SelectInput name={name} defaultValue="">
      <option value="">Seeded — not set</option>
      <option value="true">Seeded — Yes</option>
      <option value="false">Seeded — No</option>
    </SelectInput>
  )
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
