import { Link } from 'react-router-dom'
import { Pill } from './ui/primitives'
import { STATUS_LABELS } from '../lib/constants'
import { getEventDisplayName } from '../lib/displayNames'
import type { TournamentEvent } from '../types'

function eventPillVariant(status: TournamentEvent['status']): 'live' | 'upcoming' | 'draft' | 'ended' {
  if (status === 'ongoing') return 'live'
  if (status === 'upcoming') return 'upcoming'
  if (status === 'draft') return 'draft'
  return 'ended'
}

export function DivisionRow({ event, to }: { event: TournamentEvent; to: string }) {
  const name = getEventDisplayName(event)
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-500 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
        <p className="text-xs text-slate-400 capitalize mt-0.5">{event.status}</p>
      </div>
      <Pill variant={eventPillVariant(event.status)}>
        {event.status === 'ongoing' ? 'Live' : STATUS_LABELS[event.status]}
      </Pill>
    </Link>
  )
}
