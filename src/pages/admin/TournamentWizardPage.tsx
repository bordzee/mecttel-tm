import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AdminPageTitle,
  Button,
  ErrorMessage,
  FormLabel,
  MetaText,
  SubsectionTitle,
  TextInput,
} from '../../components/ui/primitives'
import {
  DivisionConfigForm,
  DIVISION_PRESETS,
  createDivisionDraft,
  divisionDraftToEventInput,
  type DivisionDraft,
} from '../../components/DivisionConfigForm'
import { createTournamentWithEvents } from '../../lib/tournamentService'

export function TournamentWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [divisions, setDivisions] = useState<DivisionDraft[]>([])

  const updateDivision = (clientId: string, draft: DivisionDraft) => {
    setDivisions((prev) => prev.map((d) => (d.clientId === clientId ? draft : d)))
  }

  const addPreset = (preset: Partial<DivisionDraft>) => {
    setDivisions((prev) => [...prev, createDivisionDraft(preset)])
  }

  const handleCreate = async () => {
    setError('')
    if (!divisions.length) {
      setError('Add at least one division')
      return
    }
    for (const d of divisions) {
      if (!d.entries_per_group) {
        setError('Each division needs a group layout')
        return
      }
    }
    setSaving(true)
    try {
      const events = divisions.map(divisionDraftToEventInput)
      const { tournament } = await createTournamentWithEvents(
        { name, venue, start_date: startDate },
        events,
      )
      navigate(`/admin/tournaments/${tournament.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <AdminPageTitle>New tournament</AdminPageTitle>
      <MetaText className="mt-1 mb-6 block">Create a meet with one or more divisions (e.g. bizdak).</MetaText>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <FormLabel>Tournament name</FormLabel>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. bizdak" required />
          </div>
          <div>
            <FormLabel>Venue</FormLabel>
            <TextInput value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div>
            <FormLabel>Start date</FormLabel>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Button onClick={() => setStep(1)} disabled={!name} fullWidth>
            Next: Add divisions
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <SubsectionTitle>Quick add</SubsectionTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {DIVISION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => addPreset(preset.draft)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-brand-500"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="dashed" fullWidth onClick={() => setDivisions((prev) => [...prev, createDivisionDraft()])}>
            + Add division
          </Button>

          {divisions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Add divisions for this tournament — singles by age, team, executive, doubles, etc.
            </p>
          ) : (
            <div className="space-y-4">
              {divisions.map((d, i) => (
                <DivisionConfigForm
                  key={d.clientId}
                  title={`Division ${i + 1}`}
                  draft={d}
                  onChange={(updated) => updateDivision(d.clientId, updated)}
                  onRemove={() => setDivisions((prev) => prev.filter((x) => x.clientId !== d.clientId))}
                />
              ))}
            </div>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={saving || divisions.length === 0}>
              {saving ? 'Creating…' : `Create ${name || 'tournament'}`}
            </Button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
