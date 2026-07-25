import { DestructiveTextButton } from './ui/primitives'
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
    <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="min-w-0">
          <span className="text-sm text-slate-900 truncate block">{getEntryDisplayName(entry)}</span>
          {org && <span className="text-xs text-slate-500 truncate block">{org}</span>}
        </div>
        {seeded && <span className="text-[11px] text-slate-400 shrink-0">{seeded}</span>}
      </div>
      {onRemove && (
        <DestructiveTextButton onClick={onRemove} className="text-xs shrink-0">
          Remove
        </DestructiveTextButton>
      )}
    </div>
  )
}
