import { WarningBanner } from './ui/primitives'

export function ConflictWarnings({ warnings }: { warnings: string[] }) {
  const filtered = warnings.filter(Boolean)
  if (filtered.length === 0) return null

  if (filtered.length === 1) {
    return <WarningBanner>{filtered[0]}</WarningBanner>
  }

  return (
    <div className="space-y-2">
      {filtered.map((w) => (
        <WarningBanner key={w}>{w}</WarningBanner>
      ))}
    </div>
  )
}
