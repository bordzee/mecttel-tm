import { useEffect, useState } from 'react'
import { AppLayout } from '../components/AppLayout'
import { TournamentCard } from '../components/TournamentCard'
import {
  EmptyStatePanel,
  ErrorBanner,
  EmptyMessage,
  SectionTitle,
  WarningBanner,
} from '../components/ui/primitives'
import { fetchPublicTournaments } from '../lib/tournamentService'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Tournament, TournamentEvent } from '../types'

export function HomePage() {
  const [ongoing, setOngoing] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [upcoming, setUpcoming] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) return
    setLoading(true)
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
        setError('')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tournaments'))
      .finally(() => setLoading(false))
  }, [])

  if (!isFirebaseConfigured) {
    return (
      <AppLayout>
        <div className="space-y-[26px] pt-1">
          <WarningBanner>
            Firebase configuration missing — live data may be unavailable.
          </WarningBanner>
          <section className="space-y-3">
            <SectionTitle live>Ongoing</SectionTitle>
            <EmptyStatePanel>No ongoing tournaments.</EmptyStatePanel>
          </section>
          <section className="space-y-3">
            <SectionTitle>Upcoming</SectionTitle>
            <EmptyStatePanel>No upcoming tournaments.</EmptyStatePanel>
          </section>
        </div>
      </AppLayout>
    )
  }

  if (loading) {
    return (
      <AppLayout>
        <EmptyMessage>Loading tournaments…</EmptyMessage>
      </AppLayout>
    )
  }

  const isEmpty = ongoing.length === 0 && upcoming.length === 0 && !error

  if (isEmpty) {
    return (
      <AppLayout>
        <div className="space-y-[26px] pt-1">
          <section className="space-y-3">
            <SectionTitle live>Ongoing</SectionTitle>
            <EmptyStatePanel>No ongoing tournaments.</EmptyStatePanel>
          </section>
          <section className="space-y-3">
            <SectionTitle>Upcoming</SectionTitle>
            <EmptyStatePanel>No upcoming tournaments.</EmptyStatePanel>
          </section>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-[26px] pt-1">
        {error && <ErrorBanner>{error}</ErrorBanner>}

        <section className="space-y-3">
          <SectionTitle live>Ongoing</SectionTitle>
          {ongoing.length === 0 ? (
            <EmptyStatePanel>No ongoing tournaments.</EmptyStatePanel>
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
            <EmptyStatePanel>No upcoming tournaments.</EmptyStatePanel>
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
