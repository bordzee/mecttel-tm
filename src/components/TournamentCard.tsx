import { Link } from 'react-router-dom'
import type { Tournament, TournamentEvent } from '../types'
import { getEventDisplayName } from '../lib/displayNames'
import { Chip, MetaIconsRow, Pill } from './ui/primitives'

function deriveStatus(events: TournamentEvent[]): 'live' | 'upcoming' | 'ended' {
  if (events.some((e) => e.status === 'ongoing')) return 'live'
  if (events.some((e) => e.status === 'upcoming')) return 'upcoming'
  return 'ended'
}

function statusLabel(status: 'live' | 'upcoming' | 'ended'): string {
  if (status === 'live') return 'Live'
  if (status === 'upcoming') return 'Upcoming'
  return 'Ended'
}

export function TournamentCard({
  tournament,
  events = [],
}: {
  tournament: Tournament
  events?: TournamentEvent[]
}) {
  const status = deriveStatus(events)
  const chipEvents = events
    .filter((e) => e.status === 'ongoing' || e.status === 'upcoming')
    .slice(0, 4)

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="block bg-card rounded-2xl border border-border p-4 hover:border-brand-500/50 transition-colors space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading font-extrabold text-[17px] text-text-primary leading-snug">
          {tournament.name}
        </h3>
        <Pill variant={status}>{statusLabel(status)}</Pill>
      </div>
      {chipEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chipEvents.map((e) => (
            <Chip key={e.id}>{getEventDisplayName(e).replace(' – ', '–')}</Chip>
          ))}
        </div>
      )}
      <MetaIconsRow date={tournament.start_date} venue={tournament.venue} />
    </Link>
  )
}
