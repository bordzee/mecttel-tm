/** "2026-08-22" -> "Aug 22, 2026". Anything that is not a plain ISO date is returned unchanged. */
export function formatDisplayDate(value: string, locale?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  // Guard against rollover such as 2026-02-31.
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return value
  }
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}
