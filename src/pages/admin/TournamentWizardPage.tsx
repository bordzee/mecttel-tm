import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { StatusPopups } from '../../components/ui/StatusPopups'
import {
  AddDivisionButton,
  AdminPageTitle,
  BackButton,
  BackLink,
  Button,
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
import { createTournament, createTournamentWithEvents, updateTournament } from '../../lib/tournamentService'
import { resolveTournamentImageForSave } from '../../lib/tournamentImageService'
import { TournamentImageUpload } from '../../components/TournamentImageUpload'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [divisions, setDivisions] = useState<DivisionDraft[]>([])

  const presetRows = useMemo(() => chunkPresets(DIVISION_PRESETS, 2), [])

  const updateDivision = (clientId: string, draft: DivisionDraft) => {
    setDivisions((prev) => prev.map((d) => (d.clientId === clientId ? draft : d)))
  }

  const addPreset = (preset: Partial<DivisionDraft>) => {
    setDivisions((prev) => [...prev, createDivisionDraft(preset)])
  }

  const persistImage = async (tournamentId: string) => {
    const imageUrl = await resolveTournamentImageForSave(tournamentId, {
      file: imageFile,
      urlInput: imageUrlInput,
    })
    if (imageUrl) {
      await updateTournament(tournamentId, { image_url: imageUrl })
    }
  }

  const handleCreateHubOnly = async () => {
    setError('')
    if (!startDate.trim()) {
      setError('Start date is required')
      return
    }
    setSaving(true)
    try {
      const tournament = await createTournament({ name, venue, start_date: startDate })
      await persistImage(tournament.id)
      navigate(`/admin/tournaments/${tournament.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateWithDivisions = async () => {
    setError('')
    if (!startDate.trim()) {
      setError('Start date is required')
      return
    }
    if (!divisions.length) {
      setError('Add at least one division')
      return
    }
    setSaving(true)
    try {
      const events = divisions.map(divisionDraftToEventInput)
      const { tournament } = await createTournamentWithEvents(
        { name, venue, start_date: startDate },
        events,
      )
      await persistImage(tournament.id)
      navigate(`/admin/tournaments/${tournament.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <StatusPopups error={error} onErrorDismiss={() => setError('')} />
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
              <FormLabel>Start date *</FormLabel>
              <TextInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <TournamentImageUpload
              urlInput={imageUrlInput}
              onUrlInputChange={setImageUrlInput}
              onFileChange={setImageFile}
              disabled={saving}
            />
            <Button onClick={handleCreateHubOnly} disabled={!name.trim() || !startDate.trim() || saving} fullWidth>
              {saving ? 'Creating…' : 'Create tournament'}
            </Button>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={!name.trim() || !startDate.trim()} fullWidth>
              Add divisions now (optional)
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

          <Button onClick={handleCreateWithDivisions} disabled={saving || divisions.length === 0} fullWidth>
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
