import { SeedBadge } from './ui/primitives'
import { seededLabel } from './SeededSelect'
import type { TournamentEntry } from '../types'
import { getEntryDisplayName } from '../lib/displayNames'
import { getEntryOrganization } from '../lib/groupLayout'

export function EntryRow({
  entry,
  onRemove,
}: {
  entry: TournamentEntry
  onRemove?: () => void
}) {
  const seeded = seededLabel(entry)
  const org = getEntryOrganization(entry)

  return (
    <div className="flex items-center gap-2.5 bg-card rounded-xl border border-border px-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[15px] font-bold text-text-primary">{getEntryDisplayName(entry)}</span>
          {seeded && <SeedBadge>{seeded}</SeedBadge>}
        </div>
        {org && <span className="text-xs text-text-steel block mt-0.5">{org}</span>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-text-steel hover:text-live shrink-0 p-1"
          aria-label="Remove entry"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
