import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { FirebaseSetupBanner } from '../../components/FirebaseSetupBanner'
import {
  DashboardTitle,
  EmptyMessage,
  ErrorBanner,
  IconTextLink,
  LinkButton,
  Pill,
  ScreenSectionTitle,
} from '../../components/ui/primitives'
import { fetchAllTournaments } from '../../lib/tournamentService'
import { getEventDisplayName } from '../../lib/displayNames'
import { useAuth } from '../../hooks/useAuth'
import { STATUS_LABELS } from '../../lib/constants'
import type { Tournament, TournamentEvent } from '../../types'

function eventPillVariant(status: TournamentEvent['status']): 'live' | 'upcoming' | 'draft' | 'ended' {
  if (status === 'ongoing') return 'live'
  if (status === 'upcoming') return 'upcoming'
  if (status === 'draft') return 'draft'
  return 'ended'
}

export function AdminDashboardPage() {
  const { signOut } = useAuth()
  const [tournaments, setTournaments] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchAllTournaments()
      .then((data) => {
        setTournaments(data)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tournaments'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-[18px]">
        <FirebaseSetupBanner />
        <div className="flex items-center justify-between gap-2">
          <DashboardTitle>Dashboard</DashboardTitle>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-text-steel font-semibold hover:text-text-bluewhite transition-colors"
          >
            Sign out
          </button>
        </div>

        <LinkButton to="/admin/tournaments/new">+ New tournament</LinkButton>
        <IconTextLink to="/admin/admins/new">Create admin account</IconTextLink>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <section className="space-y-3">
          <ScreenSectionTitle>All tournaments</ScreenSectionTitle>
          {loading ? (
            <EmptyMessage>Loading tournaments…</EmptyMessage>
          ) : tournaments.length === 0 ? (
            <EmptyMessage>No tournaments yet.</EmptyMessage>
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/tournaments/${t.id}`}
                  className="block bg-card border border-border rounded-2xl p-4 hover:border-brand-500/50 transition-colors space-y-3"
                >
                  <div className="font-heading font-extrabold text-[17px] text-text-primary leading-snug">
                    {t.name}
                  </div>
                  {t.events.length === 0 ? (
                    <div className="text-sm text-text-steel">No divisions</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.events.map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-text-bluewhite">
                            {getEventDisplayName(e).replace(' – ', '–')}
                          </span>
                          <Pill variant={eventPillVariant(e.status)}>
                            {e.status === 'ongoing' ? 'Live' : STATUS_LABELS[e.status]}
                          </Pill>
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
