import { EmptyMessage, ParticipantsTitle, SeededStarIcon } from './ui/primitives'
import { getEntryDisplayName } from '../lib/displayNames'
import { getEntryOrganization, isEntrySeeded } from '../lib/groupLayout'
import type { EventType, TournamentEntry } from '../types'

export function PublicParticipantsList({
  title = 'Participants',
  entries,
  eventType,
  rostersByTeamId,
  maxSlots,
}: {
  title?: string
  entries: TournamentEntry[]
  eventType: EventType
  rostersByTeamId?: Map<string, string[]>
  maxSlots?: number
}) {
  const countLabel =
    maxSlots != null ? `${entries.length} / ${maxSlots}` : String(entries.length)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ParticipantsTitle>{title}</ParticipantsTitle>
        <span className="text-[13px] font-semibold text-text-steel tabular-nums">{countLabel}</span>
      </div>

      {entries.length === 0 ? (
        <EmptyMessage>No entries submitted yet.</EmptyMessage>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <PublicParticipantRow
              key={entry.id}
              entry={entry}
              eventType={eventType}
              roster={entry.team_id ? rostersByTeamId?.get(entry.team_id) : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function PublicParticipantRow({
  entry,
  eventType,
  roster,
}: {
  entry: TournamentEntry
  eventType: EventType
  roster?: string[]
}) {
  const name = getEntryDisplayName(entry)
  const org = getEntryOrganization(entry)
  const seeded = isEntrySeeded(entry)
  const pairDetail =
    entry.entry_type === 'pair' && entry.pair && entry.pair.pair_name
      ? `${entry.pair.player_a} / ${entry.pair.player_b}`
      : null

  return (
    <li className="bg-card rounded-xl border border-border px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-primary truncate">{name}</p>
          {pairDetail && <p className="text-sm text-text-steel mt-0.5">{pairDetail}</p>}
          {org && <p className="text-sm text-text-steel mt-0.5">{org}</p>}
          {eventType === 'team' && roster && roster.length > 0 && (
            <p className="text-sm text-text-steel mt-1">{roster.join(' · ')}</p>
          )}
        </div>
        {seeded && (
          <span className="shrink-0 inline-flex self-center" title="Seeded" aria-label="Seeded">
            <SeededStarIcon size={18} />
          </span>
        )}
      </div>
    </li>
  )
}
