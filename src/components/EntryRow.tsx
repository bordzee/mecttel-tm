import type { TournamentEntry } from '../types'
import { getEntryDisplayName } from '../lib/displayNames'
import { getEntryOrganization, isEntrySeeded } from '../lib/groupLayout'
import { SeededStarIcon } from './ui/primitives'

export function EntryRow({
  entry,
  onEdit,
  onRemove,
}: {
  entry: TournamentEntry
  onEdit?: () => void
  onRemove?: () => void
}) {
  const org = getEntryOrganization(entry)
  const seeded = isEntrySeeded(entry)

  return (
    <div className="flex items-center gap-2.5 bg-card rounded-xl border border-border px-3 py-3">
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-bold text-text-primary block truncate">
          {getEntryDisplayName(entry)}
        </span>
        {org && <span className="text-sm text-text-steel block mt-0.5">{org}</span>}
      </div>

      {seeded && (
        <span className="shrink-0 inline-flex self-center" title="Seeded" aria-label="Seeded">
          <SeededStarIcon size={18} />
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-text-steel hover:text-brand-500 p-1"
            aria-label="Edit entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-text-steel hover:text-live p-1"
            aria-label="Remove entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
