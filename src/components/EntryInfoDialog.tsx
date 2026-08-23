import { createPortal } from 'react-dom'
import { Button, PanelSectionTitle, TagPill } from './ui/primitives'
import { getEntryDisplayName } from '../lib/displayNames'
import { getEntryOrganization, isEntrySeeded } from '../lib/groupLayout'
import type { EventType, TournamentEntry } from '../types'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-text-steel shrink-0">{label}</span>
      <span className="text-text-bluewhite font-semibold text-right">{value}</span>
    </div>
  )
}

export function EntryInfoDialog({
  open,
  entry,
  eventType,
  groupLabel,
  roster,
  onClose,
}: {
  open: boolean
  entry: TournamentEntry | null
  eventType: EventType
  groupLabel?: string | null
  roster?: string[]
  onClose: () => void
}) {
  if (!open || !entry) return null

  const name = getEntryDisplayName(entry)
  const org = getEntryOrganization(entry)
  const seeded = isEntrySeeded(entry)

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-info-title"
        className="relative w-full max-w-sm bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <PanelSectionTitle>{name}</PanelSectionTitle>
        <p id="entry-info-title" className="sr-only">
          Entry details for {name}
        </p>

        <div className="space-y-2.5 rounded-xl border border-border bg-navy/40 p-3.5">
          {groupLabel && <InfoRow label="Group" value={groupLabel} />}
          {org && <InfoRow label="Organization" value={org} />}
          <InfoRow label="Seeded" value={seeded ? 'Yes' : 'No'} />

          {entry.entry_type === 'pair' && entry.pair && (
            <>
              {entry.pair.pair_name && (
                <InfoRow label="Pair name" value={entry.pair.pair_name} />
              )}
              <InfoRow label="Player A" value={entry.pair.player_a} />
              <InfoRow label="Player B" value={entry.pair.player_b} />
            </>
          )}

          {eventType === 'team' && roster && roster.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-sm text-text-steel">Roster</p>
              <ul className="space-y-1">
                {roster.map((player) => (
                  <li key={player} className="text-sm font-semibold text-text-bluewhite">
                    {player}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {entry.entry_type === 'team' && (
          <TagPill>Team entry</TagPill>
        )}
        {entry.entry_type === 'pair' && (
          <TagPill>Doubles pair</TagPill>
        )}

        <Button onClick={onClose} fullWidth>
          Close
        </Button>
      </div>
    </div>,
    document.body,
  )
}
