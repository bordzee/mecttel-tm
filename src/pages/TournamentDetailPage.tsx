import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { DivisionRow } from '../components/DivisionRow'
import {
  BackLink,
  CenteredState,
  EmptyMessage,
  ErrorMessage,
  MetaText,
  PageTitle,
  SubsectionTitle,
} from '../components/ui/primitives'
import { fetchTournament, fetchPublicEvents } from '../lib/tournamentService'
import type { Tournament, TournamentEvent } from '../types'

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [events, setEvents] = useState<TournamentEvent[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tournamentId) return
    Promise.all([fetchTournament(tournamentId), fetchPublicEvents(tournamentId)])
      .then(([t, e]) => {
        setTournament(t)
        setEvents(e)
      })
      .catch((e) =>
        setError(
          e instanceof Error && e.message.includes('permission')
            ? 'This tournament is not public yet.'
            : e instanceof Error
              ? e.message
              : 'Failed to load tournament',
        ),
      )
  }, [tournamentId])

  if (error) {
    return (
      <AppLayout>
        <CenteredState>
          <ErrorMessage>{error}</ErrorMessage>
        </CenteredState>
      </AppLayout>
    )
  }

  if (!tournament) {
    return (
      <AppLayout>
        <EmptyMessage>Loading…</EmptyMessage>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackLink to="/">← Back</BackLink>

        <PageTitle>{tournament.name}</PageTitle>

        <dl className="space-y-1">
          {tournament.start_date && <MetaText>Date: {tournament.start_date}</MetaText>}
          {tournament.venue && <MetaText>Venue: {tournament.venue}</MetaText>}
        </dl>

        <section className="space-y-3 pt-1">
          <SubsectionTitle>Choose a division</SubsectionTitle>
          {events.length === 0 ? (
            <EmptyMessage>No public divisions available yet.</EmptyMessage>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <DivisionRow
                  key={event.id}
                  event={event}
                  to={`/tournaments/${tournamentId}/events/${event.id}`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
