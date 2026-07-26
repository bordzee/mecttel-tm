import { Link } from 'react-router-dom'
import { Pill } from './ui/primitives'
import { getEventDisplayName } from '../lib/displayNames'
import type { TournamentEvent } from '../types'

function eventPillVariant(status: TournamentEvent['status']): 'live' | 'upcoming' | 'draft' | 'ended' {
  if (status === 'ongoing') return 'live'
  if (status === 'upcoming') return 'upcoming'
  if (status === 'draft') return 'draft'
  return 'ended'
}

function divisionSubtitle(status: TournamentEvent['status']): string {
  if (status === 'ongoing') return 'Group stage in progress'
  if (status === 'upcoming') return 'Starts soon'
  if (status === 'draft') return 'Draft — not published'
  return 'Ended'
}

export function DivisionRow({ event, to }: { event: TournamentEvent; to: string }) {
  const name = getEventDisplayName(event)
  return (
    <Link
      to={to}
      className="flex items-center gap-3 bg-card rounded-xl border border-border px-3.5 py-3.5 hover:border-brand-500/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-text-primary truncate">{name}</p>
        <p className="text-xs text-text-steel mt-1">{divisionSubtitle(event.status)}</p>
      </div>
      <Pill variant={eventPillVariant(event.status)}>
        {event.status === 'ongoing' ? 'Live' : event.status === 'upcoming' ? 'Upcoming' : event.status === 'draft' ? 'Draft' : 'Ended'}
      </Pill>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-steel shrink-0"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}
