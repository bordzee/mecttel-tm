import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { FirebaseSetupBanner } from '../../components/FirebaseSetupBanner'
import {
  DashboardTitle,
  EmptyMessage,
  LinkButton,
  Pill,
  ScreenSectionTitle,
} from '../../components/ui/primitives'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { fetchAllTournaments } from '../../lib/tournamentService'
import { getEventDisplayName } from '../../lib/displayNames'
import { useAuth } from '../../hooks/useAuth'
import { STATUS_LABELS } from '../../lib/constants'
import { useMinLoading } from '../../hooks/useMinLoading'
import { AdminDashboardSkeleton } from '../../components/ui/Skeleton'
import type { Tournament, TournamentEvent } from '../../types'

function eventPillVariant(status: TournamentEvent['status']): 'live' | 'upcoming' | 'draft' | 'ended' {
  if (status === 'ongoing') return 'live'
  if (status === 'upcoming') return 'upcoming'
  if (status === 'draft') return 'draft'
  return 'ended'
}

export function AdminDashboardPage() {
  const { signOut, isSuperAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<(Tournament & { events: TournamentEvent[] })[]>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const navMessage = (location.state as { message?: string } | null)?.message
    if (navMessage) {
      setMessage(navMessage)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardTitle>Dashboard</DashboardTitle>
          <div className="flex items-center gap-2">
            <LinkButton to="/admin/tournaments/new" className="!w-auto px-5">
              New tournament
            </LinkButton>
          </div>
        </div>

        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />

        <section className="space-y-3">
          <ScreenSectionTitle>All tournaments</ScreenSectionTitle>
          {showSkeleton ? (
            <AdminDashboardSkeleton />
          ) : tournaments.length === 0 ? (
            <EmptyMessage>No tournaments yet.</EmptyMessage>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/tournaments/${t.id}`}
                  className="block bg-card border border-border rounded-[14px] p-5 hover:bg-card-raised/60 transition-colors space-y-3"
                >
                  <div className="font-heading font-semibold text-[17px] tracking-tight text-text-primary leading-snug">
                    {t.name}
                  </div>
                  {t.events.length === 0 ? (
                    <div className="text-sm text-text-steel">No divisions</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.events.map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text-bluewhite">
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm">
          <div className="flex items-center gap-5">
            <Link
              to="/admin/account"
              className="inline-flex min-h-10 items-center text-text-steel font-medium hover:text-text-primary transition-colors"
            >
              Account
            </Link>
            {isSuperAdmin && (
              <Link
                to="/admin/admins"
                className="inline-flex min-h-10 items-center text-text-steel font-medium hover:text-text-primary transition-colors"
              >
                Admins
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex min-h-10 items-center text-text-steel font-medium hover:text-text-primary transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
