import { useEffect, useState } from 'react'
import { AppLayout } from '../components/AppLayout'
import { TournamentCard } from '../components/TournamentCard'
import { CenteredState, EmptyMessage, ErrorMessage, SectionTitle } from '../components/ui/primitives'
import { fetchPublicTournaments } from '../lib/tournamentService'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Tournament, TournamentEvent } from '../types'

export function HomePage() {
  const [ongoing, setOngoing] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [upcoming, setUpcoming] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) return
    fetchPublicTournaments()
      .then((all) => {
        setOngoing(all.filter((t) => t.events.some((e) => e.status === 'ongoing')))
        setUpcoming(
          all.filter(
            (t) =>
              t.events.some((e) => e.status === 'upcoming') &&
              !t.events.some((e) => e.status === 'ongoing'),
          ),
        )
      })
      .catch((e) => setError(e.message))
  }, [])

  if (!isFirebaseConfigured) {
    return (
      <AppLayout>
        <div className="bg-warning-bg border border-warning-border rounded-xl p-4 text-sm text-warning-text">
          Configure Firebase: copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to{' '}
          <code className="bg-amber-100 px-1 rounded">.env</code> and add your Firebase web app config.
        </div>
      </AppLayout>
    )
  }

  const isEmpty = ongoing.length === 0 && upcoming.length === 0 && !error

  if (isEmpty) {
    return (
      <AppLayout>
        <CenteredState>
          <EmptyMessage>No ongoing tournaments.</EmptyMessage>
          <EmptyMessage>No upcoming tournaments.</EmptyMessage>
        </CenteredState>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {error && <ErrorMessage>{error}</ErrorMessage>}

        <section className="space-y-3">
          <SectionTitle live>Ongoing</SectionTitle>
          {ongoing.length === 0 ? (
            <EmptyMessage>No ongoing tournaments.</EmptyMessage>
          ) : (
            <div className="space-y-3">
              {ongoing.map((t) => (
                <TournamentCard key={t.id} tournament={t} events={t.events} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionTitle>Upcoming</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyMessage>No upcoming tournaments.</EmptyMessage>
          ) : (
            <div className="space-y-3">
              {upcoming.map((t) => (
                <TournamentCard key={t.id} tournament={t} events={t.events} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
