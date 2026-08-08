import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { FirebaseSetupBanner } from '../../components/FirebaseSetupBanner'
import {
  DivisionConfigForm,
  createDivisionDraft,
  divisionDraftToEventInput,
} from '../../components/DivisionConfigForm'
import {
  EventPageTitle,
  BackLink,
  Button,
  EmptyMessage,
  ErrorBanner,
  InlineError,
} from '../../components/ui/primitives'
import { createEvent, fetchTournament } from '../../lib/tournamentService'
import type { Tournament } from '../../types'

export function AddEventPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [draft, setDraft] = useState(createDivisionDraft())
  const [saving, setSaving] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tournamentId) return
    setPageLoading(true)
    setLoadError('')
    fetchTournament(tournamentId)
      .then(setTournament)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Tournament not found'))
      .finally(() => setPageLoading(false))
  }, [tournamentId])

  const handleCreate = async () => {
    if (!tournamentId) return
    setSaving(true)
    setError('')
    try {
      const event = await createEvent(tournamentId, divisionDraftToEventInput(draft))
      navigate(`/admin/tournaments/${tournamentId}/events/${event.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add division')
    } finally {
      setSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <AdminLayout>
        <EmptyMessage>Loading…</EmptyMessage>
      </AdminLayout>
    )
  }

  if (loadError) {
    return (
      <AdminLayout>
        <BackLink to="/admin">Dashboard</BackLink>
        <ErrorBanner>{loadError}</ErrorBanner>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <FirebaseSetupBanner />
        <BackLink to={`/admin/tournaments/${tournamentId}`}>{tournament?.name ?? 'Tournament'}</BackLink>
        <EventPageTitle>Add division</EventPageTitle>

        <DivisionConfigForm draft={draft} onChange={setDraft} />

        {error && <InlineError>{error}</InlineError>}

        <Button onClick={handleCreate} disabled={saving} fullWidth>
          {saving ? 'Adding…' : 'Add division'}
        </Button>
      </div>
    </AdminLayout>
  )
}
