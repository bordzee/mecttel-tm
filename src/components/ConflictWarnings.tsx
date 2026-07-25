export function ConflictWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null

  return (
    <div className="bg-warning-bg border border-warning-border rounded-xl p-4 space-y-2">
      <p className="text-sm font-medium text-warning-text">Warnings</p>
      <ul className="text-sm text-warning-text space-y-1 list-disc list-inside">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  )
}
