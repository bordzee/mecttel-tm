import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { PublicParticipantsList } from '../components/PublicParticipantsList'
import {
  BackLink,
  ConfigSummaryCard,
  EmptyMessage,
  ErrorMessage,
  LinkButton,
  PageTitle,
  StatusChip,
  TagPill,
} from '../components/ui/primitives'
import { loadTeamRostersByTeamId } from '../lib/entryDisplay'
import { fetchTournament, fetchEvent, fetchEntries } from '../lib/tournamentService'
import { EVENT_TYPE_LABELS, STATUS_LABELS } from '../lib/constants'
import { getCategoryDisplay, getEventDisplayName } from '../lib/displayNames'
import type { Tournament, TournamentEvent, TournamentEntry } from '../types'

export function EventDetailPage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [rostersByTeamId, setRostersByTeamId] = useState<Map<string, string[]>>(new Map())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tournamentId || !eventId) return
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
      })
      .catch((e) => setError(e.message))
  }, [tournamentId, eventId])

  if (error) {
    return (
      <AppLayout>
        <ErrorMessage>{error}</ErrorMessage>
      </AppLayout>
    )
  }

  if (!tournament || !event) {
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
        : event.status === 'ongoing'
          ? `${cfg.group_count} groups × ${cfg.entries_per_group}`
          : `Planned ${cfg.group_count} × ${cfg.entries_per_group} (at full ${cfg.total_slots} slots)`
      : null

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackLink to={`/tournaments/${tournamentId}`}>← {tournament.name}</BackLink>

        <PageTitle>{getEventDisplayName(event)}</PageTitle>

        <div className="flex flex-wrap gap-2">
          <TagPill>{EVENT_TYPE_LABELS[event.event_type]}</TagPill>
          {(event.category || cfg.category_label) && (
            <TagPill>{getCategoryDisplay(event.category, cfg.category_label)}</TagPill>
          )}
          <StatusChip>{STATUS_LABELS[event.status]}</StatusChip>
        </div>

        <ConfigSummaryCard>
          <p>Entries: {entries.length}/{cfg.total_slots}</p>
          {cfg.team_format && <p>Team format: {cfg.team_format}</p>}
          {groupLayout && <p>Group layout: {groupLayout}</p>}
          <p>
            Set rules: Group BO{cfg.set_rules.group}, Finals BO{cfg.set_rules.finals}
          </p>
        </ConfigSummaryCard>

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
