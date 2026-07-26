import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { PublicParticipantsList } from '../components/PublicParticipantsList'
import {
  BackLink,
  ConfigRowsCard,
  EmptyMessage,
  ErrorMessage,
  EventPageTitle,
  LinkButton,
  Pill,
  TagPill,
  WarningBanner,
} from '../components/ui/primitives'
import { loadTeamRostersByTeamId } from '../lib/entryDisplay'
import { fetchTournament, fetchEvent, fetchEntries } from '../lib/tournamentService'
import { isFirebaseConfigured } from '../lib/firebase'
import { EVENT_TYPE_LABELS } from '../lib/constants'
import { getCategoryDisplay, getEventDisplayName } from '../lib/displayNames'
import type { Tournament, TournamentEvent, TournamentEntry } from '../types'

function mapFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Failed to load division'
  if (msg.includes('permission') || msg.includes('insufficient')) {
    return 'This division is not public yet or has ended.'
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return 'This division was not found or has been removed.'
  }
  return msg
}

export function EventDetailPage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [rostersByTeamId, setRostersByTeamId] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    if (!tournamentId || !eventId) {
      setError('Division not found')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setTournament(null)
    setEvent(null)
    setEntries([])

    Promise.all([
      fetchTournament(tournamentId),
      fetchEvent(tournamentId, eventId),
      fetchEntries(eventId),
    ])
      .then(async ([t, e, entriesList]) => {
        setTournament(t)
        setEvent(e)
        setEntries(entriesList)
        if (e.event_type === 'team') {
          setRostersByTeamId(await loadTeamRostersByTeamId(entriesList))
        } else {
          setRostersByTeamId(new Map())
        }
        setError('')
      })
      .catch((e) => setError(mapFetchError(e)))
      .finally(() => setLoading(false))
  }, [tournamentId, eventId])

  if (!isFirebaseConfigured) {
    return (
      <AppLayout>
        <WarningBanner>
          Firebase is not configured — live division data is unavailable.
        </WarningBanner>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <ErrorMessage>{error}</ErrorMessage>
      </AppLayout>
    )
  }

  if (loading || !tournament || !event) {
    return (
      <AppLayout>
        <EmptyMessage>Loading…</EmptyMessage>
      </AppLayout>
    )
  }

  const cfg = event.config
  const groupLayout =
    cfg.entries_per_group && cfg.group_count
      ? cfg.group_sizes
        ? `${cfg.group_count} groups (${cfg.group_sizes.join('+')})`
        : `${cfg.group_count} groups of ${cfg.entries_per_group}`
      : null

  const configRows = [
    { label: 'Entries', value: `${entries.length} / ${cfg.total_slots}` },
    ...(groupLayout ? [{ label: 'Group layout', value: groupLayout }] : []),
    { label: 'Group stage', value: `Best of ${cfg.set_rules.group}` },
    { label: 'Final', value: `Best of ${cfg.set_rules.finals}` },
    ...(cfg.team_format ? [{ label: 'Team format', value: cfg.team_format }] : []),
  ]

  return (
    <AppLayout>
      <div className="space-y-[18px]">
        <BackLink to={`/tournaments/${tournamentId}`}>{tournament.name}</BackLink>

        <EventPageTitle>{getEventDisplayName(event)}</EventPageTitle>

        <div className="flex flex-wrap gap-1.5">
          <TagPill>{EVENT_TYPE_LABELS[event.event_type]}</TagPill>
          {event.category && (
            <TagPill>{getCategoryDisplay(event.category)}</TagPill>
          )}
          {!event.category && cfg.category_label && (
            <TagPill>{cfg.category_label}</TagPill>
          )}
          {event.status === 'ongoing' && <Pill variant="live">Live</Pill>}
          {event.status === 'upcoming' && <Pill variant="upcoming">Upcoming</Pill>}
        </div>

        <ConfigRowsCard rows={configRows} />

        <PublicParticipantsList
          entries={entries}
          eventType={event.event_type}
          rostersByTeamId={rostersByTeamId}
          maxSlots={cfg.total_slots}
        />

        {event.status === 'ongoing' && (
          <LinkButton to={`/live/${tournamentId}/${eventId}`}>View live bracket</LinkButton>
        )}
      </div>
    </AppLayout>
  )
}
