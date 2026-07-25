import { seededLabel } from './SeededSelect'
import { EmptyMessage, SubsectionTitle } from './ui/primitives'
import { getEntryDisplayName } from '../lib/displayNames'
import { getEntryOrganization } from '../lib/groupLayout'
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
    maxSlots != null ? `${entries.length}/${maxSlots}` : String(entries.length)

  return (
    <section className="space-y-3">
      <SubsectionTitle>
        {title} ({countLabel})
      </SubsectionTitle>

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
  const seeded = seededLabel(entry)
  const pairDetail =
    entry.entry_type === 'pair' && entry.pair && entry.pair.pair_name
      ? `${entry.pair.player_a} / ${entry.pair.player_b}`
      : null

  return (
    <li className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{name}</p>
          {pairDetail && <p className="text-xs text-slate-500 mt-0.5">{pairDetail}</p>}
          {org && <p className="text-xs text-slate-500 mt-0.5">{org}</p>}
          {eventType === 'team' && roster && roster.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">{roster.join(' · ')}</p>
          )}
        </div>
        {seeded && (
          <span className="text-[11px] text-slate-400 shrink-0">{seeded}</span>
        )}
      </div>
    </li>
  )
}
