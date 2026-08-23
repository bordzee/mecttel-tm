/** Human-readable table label (1-based index). */
export function formatTableLabel(tableNumber: number): string {
  return `Table #${tableNumber}`
}

export function normalizeTableCount(tableCount?: number): number {
  const n = tableCount ?? 1
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), 24)
}
