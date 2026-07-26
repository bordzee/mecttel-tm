import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AddDivisionButton,
  AdminPageTitle,
  BackButton,
  BackLink,
  Button,
  ErrorMessage,
  FormLabel,
  QuickAddPill,
  StepIndicator,
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

function chunkPresets<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

export function TournamentWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [divisions, setDivisions] = useState<DivisionDraft[]>([])

  const presetRows = useMemo(() => chunkPresets(DIVISION_PRESETS, 2), [])

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
      {step === 0 && (
        <div className="space-y-5">
          <BackLink to="/admin">Dashboard</BackLink>
          <AdminPageTitle>New tournament</AdminPageTitle>
          <StepIndicator steps={['Details', 'Divisions']} activeIndex={0} />
          <div className="space-y-4">
            <div>
              <FormLabel>Tournament name *</FormLabel>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MECTTEL Table Tennis Championship 2026"
                required
              />
            </div>
            <div>
              <FormLabel>Venue</FormLabel>
              <TextInput
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="MECTTEL Sports Hall"
              />
            </div>
            <div>
              <FormLabel>Start date</FormLabel>
              <TextInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <Button onClick={() => setStep(1)} disabled={!name} fullWidth>
              Next: Add divisions
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-[18px]">
          <BackButton onClick={() => setStep(0)}>Details</BackButton>
          <AdminPageTitle>Add divisions</AdminPageTitle>
          <StepIndicator steps={['Details', 'Divisions']} activeIndex={1} />

          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-text-steel">Quick add</p>
            <div className="space-y-2">
              {presetRows.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-2 gap-2">
                  {row.map((preset) => (
                    <QuickAddPill
                      key={preset.label}
                      label={preset.label}
                      onClick={() => addPreset(preset.draft)}
                      className="w-full"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <AddDivisionButton onClick={() => setDivisions((prev) => [...prev, createDivisionDraft()])} />

          {divisions.length > 0 && (
            <div className="space-y-3.5">
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

          <Button onClick={handleCreate} disabled={saving || divisions.length === 0} fullWidth>
            {saving ? 'Creating…' : `Create ${name || 'tournament'}`}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setStep(0)}>
            Back
          </Button>
        </div>
      )}
    </AdminLayout>
  )
}
