import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { DivisionRow } from '../components/DivisionRow'
import {
  BackLink,
  CenteredState,
  EmptyMessage,
  EventPageTitle,
  MetaIconsRow,
  ScreenSectionTitle,
  WarningBanner,
} from '../components/ui/primitives'
import { fetchTournament, fetchPublicEvents } from '../lib/tournamentService'
import { isFirebaseConfigured } from '../lib/firebase'
import { useMinLoading } from '../hooks/useMinLoading'
import { TournamentDetailSkeleton } from '../components/ui/Skeleton'
import { StatusPopups } from '../components/ui/StatusPopups'
import type { Tournament, TournamentEvent } from '../types'

function mapFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Failed to load tournament'
  if (msg.includes('permission') || msg.includes('insufficient')) {
    return 'This tournament is not public yet.'
  }
  return msg
}

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [events, setEvents] = useState<TournamentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    if (!tournamentId) {
      setError('Tournament not found')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setTournament(null)
    setEvents([])

    Promise.all([fetchTournament(tournamentId), fetchPublicEvents(tournamentId)])
      .then(([t, e]) => {
        setTournament(t)
        setEvents(e)
        setError('')
      })
      .catch((e) => setError(mapFetchError(e)))
      .finally(() => setLoading(false))
  }, [tournamentId])

  useEffect(() => {
    setErrorDismissed(false)
  }, [error])

  if (!isFirebaseConfigured) {
    return (
      <AppLayout>
        <CenteredState>
          <WarningBanner>
            Firebase is not configured — live tournament data is unavailable.
          </WarningBanner>
        </CenteredState>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <CenteredState>
          {!errorDismissed ? (
            <StatusPopups error={error} onErrorDismiss={() => setErrorDismissed(true)} />
          ) : (
            <EmptyMessage>{error}</EmptyMessage>
          )}
        </CenteredState>
      </AppLayout>
    )
  }

  if (showSkeleton || !tournament) {
    return (
      <AppLayout>
        <TournamentDetailSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <BackLink to="/">Home</BackLink>

        <div className="space-y-2.5">
          <EventPageTitle>{tournament.name}</EventPageTitle>
          <MetaIconsRow date={tournament.start_date} venue={tournament.venue} />
        </div>

        <section className="space-y-3">
          <ScreenSectionTitle>Choose a division</ScreenSectionTitle>
          {events.length === 0 ? (
            <EmptyMessage>No public divisions available yet.</EmptyMessage>
          ) : (
            <div className="space-y-2.5">
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
