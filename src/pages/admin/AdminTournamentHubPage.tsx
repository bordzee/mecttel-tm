import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AdminPageTitle,
  BackLink,
  Button,
  DestructiveTextButton,
  ErrorMessage,
  MetaText,
  SubsectionTitle,
  SuccessMessage,
  TextInput,
} from '../../components/ui/primitives'
import {
  fetchTournament,
  fetchEvents,
  updateTournament,
  deleteTournament,
  deleteEvent,
} from '../../lib/tournamentService'
import { getEventDisplayName } from '../../lib/displayNames'
import { STATUS_LABELS } from '../../lib/constants'
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!tournamentId) return
    const [t, e] = await Promise.all([fetchTournament(tournamentId), fetchEvents(tournamentId)])
    setTournament(t)
    setEvents(e)
    setEditName(t.name)
    setEditVenue(t.venue ?? '')
    setEditDate(t.start_date ?? '')
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [tournamentId])

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
      setMessage('Tournament updated')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTournament = async () => {
    if (!tournament) return
    if (!confirm(`Delete "${tournament.name}" and all divisions? This cannot be undone.`)) return
    setLoading(true)
    try {
      await deleteTournament(tournament.id)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (event: TournamentEvent) => {
    if (!tournamentId) return
    if (!confirm(`Delete division "${getEventDisplayName(event)}" and all its data?`)) return
    setLoading(true)
    try {
      await deleteEvent(tournamentId, event.id)
      setMessage('Division removed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete division')
    } finally {
      setLoading(false)
    }
  }

  if (!tournament) {
    return (
      <AdminLayout>
        <p className="text-slate-500">Loading…</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <BackLink to="/admin">← Dashboard</BackLink>

      <div className="flex items-start justify-between gap-2 mt-4">
        <div>
          <AdminPageTitle>{tournament.name}</AdminPageTitle>
          {tournament.venue && <MetaText className="mt-1 block">{tournament.venue}</MetaText>}
          {tournament.start_date && <MetaText>{tournament.start_date}</MetaText>}
        </div>
        <div className="flex gap-1 items-center">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-sm text-brand-600 font-medium hover:text-brand-700 px-2 py-1"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <DestructiveTextButton onClick={handleDeleteTournament}>Delete</DestructiveTextButton>
        </div>
      </div>

      {message && <SuccessMessage>{message}</SuccessMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {editing && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
          <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tournament name" />
          <TextInput value={editVenue} onChange={(e) => setEditVenue(e.target.value)} placeholder="Venue" />
          <TextInput type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          <Button onClick={handleSave} disabled={loading} fullWidth>
            Save changes
          </Button>
        </div>
      )}

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <SubsectionTitle>Divisions / events</SubsectionTitle>
          <Link
            to={`/admin/tournaments/${tournamentId}/events/new`}
            className="text-sm text-brand-600 font-medium hover:text-brand-700"
          >
            + Add division
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No divisions yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <Link
                  to={`/admin/tournaments/${tournamentId}/events/${event.id}`}
                  className="flex-1 min-w-0 hover:text-brand-600"
                >
                  <div className="font-medium">{getEventDisplayName(event)}</div>
                  <div className="text-sm text-slate-500 mt-0.5 capitalize">
                    {STATUS_LABELS[event.status]}
                  </div>
                </Link>
                {event.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event)}
                    className="text-xs text-red-600 shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
