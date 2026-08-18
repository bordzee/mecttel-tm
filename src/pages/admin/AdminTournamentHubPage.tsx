import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { FirebaseSetupBanner } from '../../components/FirebaseSetupBanner'
import { DivisionRow } from '../../components/DivisionRow'
import {
  AdminPageTitle,
  AddDivisionLink,
  BackLink,
  Button,
  DeleteConfirmPanel,
  ErrorMessage,
  IconActionButton,
  MetaIconsRow,
  PanelSectionTitle,
  ScreenSectionTitle,
  SuccessBanner,
  TextInput,
} from '../../components/ui/primitives'
import {
  fetchTournament,
  fetchEvents,
  updateTournament,
  deleteTournament,
} from '../../lib/tournamentService'
import { useMinLoading } from '../../hooks/useMinLoading'
import { AdminHubSkeleton } from '../../components/ui/Skeleton'
import type { Tournament, TournamentEvent } from '../../types'

export function AdminTournamentHubPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [events, setEvents] = useState<TournamentEvent[]>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const showPageSkeleton = useMinLoading(pageLoading)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!tournamentId) return
    const [t, e] = await Promise.all([fetchTournament(tournamentId), fetchEvents(tournamentId)])
    setTournament(t)
    setEvents(e)
    setEditName(t.name)
    setEditVenue(t.venue ?? '')
    setEditDate(t.start_date ?? '')
  }, [tournamentId])

  useEffect(() => {
    setPageLoading(true)
    setLoadError('')
    load()
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setPageLoading(false))
  }, [load])

  const handleSave = async () => {
    if (!tournamentId) return
    setLoading(true)
    setError('')
    try {
      await updateTournament(tournamentId, {
        name: editName,
        venue: editVenue,
        start_date: editDate,
      })
      setEditing(false)
      setMessage('Changes saved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTournament = async () => {
    if (!tournament) return
    setLoading(true)
    try {
      await deleteTournament(tournament.id)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (showPageSkeleton) {
    return (
      <AdminLayout>
        <AdminHubSkeleton />
      </AdminLayout>
    )
  }

  if (loadError || !tournament) {
    return (
      <AdminLayout>
        <BackLink to="/admin">Dashboard</BackLink>
        <ErrorMessage>{loadError || 'Tournament not found'}</ErrorMessage>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <FirebaseSetupBanner />
        <BackLink to="/admin">Dashboard</BackLink>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <AdminPageTitle>{tournament.name}</AdminPageTitle>
            <MetaIconsRow date={tournament.start_date} venue={tournament.venue} />
          </div>
          <div className="flex gap-2 shrink-0">
            <IconActionButton onClick={() => setEditing((v) => !v)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
              </svg>
            </IconActionButton>
            <IconActionButton variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </IconActionButton>
          </div>
        </div>

        {message && <SuccessBanner>{message}</SuccessBanner>}
        {error && <ErrorMessage>{error}</ErrorMessage>}

        {editing && (
          <div className="bg-card border border-border-strong rounded-2xl p-4 space-y-3.5">
            <PanelSectionTitle>Edit tournament</PanelSectionTitle>
            <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tournament name" />
            <TextInput value={editVenue} onChange={(e) => setEditVenue(e.target.value)} placeholder="Venue" />
            <TextInput type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <Button onClick={handleSave} disabled={loading} fullWidth>
              Save changes
            </Button>
          </div>
        )}

        {showDeleteConfirm && (
          <DeleteConfirmPanel
            title="Delete this tournament?"
            description="This permanently removes the tournament and all its divisions."
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteTournament}
            confirming={loading}
          />
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <ScreenSectionTitle>Divisions</ScreenSectionTitle>
            {tournamentId && <AddDivisionLink to={`/admin/tournaments/${tournamentId}/events/new`} />}
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-text-steel">No divisions yet. Add one to get started.</p>
          ) : (
            <div className="space-y-2.5">
              {events.map((event) => (
                <DivisionRow
                  key={event.id}
                  event={event}
                  to={`/admin/tournaments/${tournamentId}/events/${event.id}`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
