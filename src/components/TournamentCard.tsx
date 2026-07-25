import { Link } from 'react-router-dom'
import type { Tournament, TournamentEvent } from '../types'
import { getEventDisplayName } from '../lib/displayNames'
import { Pill } from './ui/primitives'

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
  const meta = [tournament.start_date, tournament.venue].filter(Boolean).join(' · ')
  const showChips = status === 'live' && events.length > 0

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-brand-500 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading font-semibold text-base text-slate-900">{tournament.name}</h3>
        <Pill variant={status}>{statusLabel(status)}</Pill>
      </div>
      {showChips && (
        <div className="flex flex-wrap gap-1.5">
          {events
            .filter((e) => e.status === 'ongoing' || e.status === 'upcoming')
            .slice(0, 4)
            .map((e) => (
              <span
                key={e.id}
                className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded"
              >
                {getEventDisplayName(e).replace(' – ', '–')}
              </span>
            ))}
        </div>
      )}
      {meta && <p className="text-[13px] text-slate-500">{meta}</p>}
    </Link>
  )
}
