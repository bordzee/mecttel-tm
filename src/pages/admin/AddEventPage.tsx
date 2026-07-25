import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  DivisionConfigForm,
  createDivisionDraft,
  divisionDraftToEventInput,
} from '../../components/DivisionConfigForm'
import {
  AdminPageTitle,
  BackLink,
  Button,
  ErrorMessage,
} from '../../components/ui/primitives'
import { createEvent, fetchTournament } from '../../lib/tournamentService'
import type { Tournament } from '../../types'

export function AddEventPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [draft, setDraft] = useState(createDivisionDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tournamentId) return
    fetchTournament(tournamentId).then(setTournament).catch(console.error)
  }, [tournamentId])

  const handleCreate = async () => {
    if (!tournamentId) return
    if (!draft.entries_per_group) {
      setError('Select a group layout')
      return
    }
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

  return (
    <AdminLayout>
      <BackLink to={`/admin/tournaments/${tournamentId}`}>← {tournament?.name ?? 'Tournament'}</BackLink>
      <AdminPageTitle>Add division</AdminPageTitle>

      <div className="mt-6 space-y-4">
        <DivisionConfigForm draft={draft} onChange={setDraft} />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button onClick={handleCreate} disabled={saving} fullWidth>
          {saving ? 'Adding…' : 'Add division'}
        </Button>
      </div>
    </AdminLayout>
  )
}
