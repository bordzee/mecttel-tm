import { WarningBanner } from './ui/primitives'

/**
 * One warning shows inline. Several collapse into a single summary so they never
 * push the controls below the fold; the list opens on demand.
 */
export function ConflictWarnings({ warnings }: { warnings: string[] }) {
  const filtered = [...new Set(warnings.filter(Boolean))]
  if (filtered.length === 0) return null

  if (filtered.length === 1) {
    return <WarningBanner>{filtered[0]}</WarningBanner>
  }

  return (
    <details className="group rounded-xl bg-amber-soft">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3.5 text-[13px] font-medium text-text-primary [&::-webkit-details-marker]:hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-amber"
          aria-hidden
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <span className="flex-1">{filtered.length} draw warnings to review</span>
        <span className="text-text-steel group-open:hidden">Show</span>
        <span className="hidden text-text-steel group-open:inline">Hide</span>
      </summary>
      <ul className="space-y-1.5 px-3.5 pb-3.5 pl-[42px] text-[13px] text-text-steel">
        {filtered.map((w, index) => (
          <li key={`${index}-${w}`}>{w}</li>
        ))}
      </ul>
    </details>
  )
}
