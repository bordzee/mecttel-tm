import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  EmptyMessage,
  LinkButton,
  PageTitle,
  SubsectionTitle,
  TextLink,
} from '../../components/ui/primitives'
import { fetchAllTournaments } from '../../lib/tournamentService'
import { getEventDisplayName } from '../../lib/displayNames'
import { useAuth } from '../../hooks/useAuth'
import { STATUS_LABELS } from '../../lib/constants'
import type { Tournament, TournamentEvent } from '../../types'

export function AdminDashboardPage() {
  const { signOut } = useAuth()
  const [tournaments, setTournaments] = useState<(Tournament & { events: TournamentEvent[] })[]>([])

  useEffect(() => {
    fetchAllTournaments().then(setTournaments).catch(console.error)
  }, [])

  return (
    <AdminLayout>
      <div className="flex items-center justify-between gap-2">
        <PageTitle>Dashboard</PageTitle>
        <button type="button" onClick={() => signOut()} className="text-sm text-brand-600 hover:text-brand-700">
          Sign out
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <LinkButton to="/admin/tournaments/new">+ New tournament</LinkButton>
        <TextLink to="/admin/admins/new">Create admin account</TextLink>
      </div>

      <section className="mt-8 space-y-3">
        <SubsectionTitle>All tournaments</SubsectionTitle>
        {tournaments.length === 0 ? (
          <EmptyMessage>No tournaments yet.</EmptyMessage>
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to={`/admin/tournaments/${t.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-brand-500 transition-colors"
              >
                <div className="font-medium text-slate-900">{t.name}</div>
                {t.events.length === 0 ? (
                  <div className="text-sm text-slate-500 mt-1">No divisions</div>
                ) : (
                  <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                    {t.events.map((e) => (
                      <div key={e.id}>
                        {getEventDisplayName(e)} · {STATUS_LABELS[e.status]}
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
