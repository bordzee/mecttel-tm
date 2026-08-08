import { useState } from 'react'
import type { EventType, TournamentEntry } from '../types'
import { SeededSelect } from './SeededSelect'
import {
  Button,
  ErrorBanner,
  FormLabel,
  PanelSectionTitle,
  TextInput,
} from './ui/primitives'

export type EntryEditFormState = {
  name: string
  organization: string
  seeded: boolean | null
  pair_name: string
  player_a: string
  player_b: string
  roster: string
}

export function entryToEditForm(
  entry: TournamentEntry,
  roster?: string[],
): EntryEditFormState {
  if (entry.entry_type === 'team' && entry.team) {
    return {
      name: entry.team.name,
      organization: entry.team.organization ?? '',
      seeded: entry.seeded ?? entry.team.seeded,
      pair_name: '',
      player_a: '',
      player_b: '',
      roster: roster?.join(', ') ?? '',
    }
  }
  if (entry.entry_type === 'player' && entry.player) {
    return {
      name: entry.player.name,
      organization: entry.player.organization ?? '',
      seeded: entry.seeded ?? entry.player.seeded,
      pair_name: '',
      player_a: '',
      player_b: '',
      roster: '',
    }
  }
  if (entry.entry_type === 'pair' && entry.pair) {
    return {
      name: '',
      organization: entry.pair.organization ?? '',
      seeded: entry.seeded ?? entry.pair.seeded,
      pair_name: entry.pair.pair_name ?? '',
      player_a: entry.pair.player_a,
      player_b: entry.pair.player_b,
      roster: '',
    }
  }
  return {
    name: '',
    organization: '',
    seeded: null,
    pair_name: '',
    player_a: '',
    player_b: '',
    roster: '',
  }
}

export function EntryEditDialog({
  entry,
  eventType,
  rosterSize,
  allowRosterEdit,
  initialRoster,
  error,
  confirming,
  onCancel,
  onSave,
}: {
  entry: TournamentEntry
  eventType: EventType
  rosterSize?: number
  allowRosterEdit: boolean
  initialRoster?: string[]
  error?: string
  confirming?: boolean
  onCancel: () => void
  onSave: (form: EntryEditFormState) => void
}) {
  const [form, setForm] = useState<EntryEditFormState>(() =>
    entryToEditForm(entry, initialRoster),
  )

  const patch = (partial: Partial<EntryEditFormState>) =>
    setForm((prev) => ({ ...prev, ...partial }))

  const isPlayer = eventType === 'single' || eventType === 'executive'
  const isDoubles = eventType === 'doubles'
  const isTeam = eventType === 'team'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="entry-edit-title"
      >
        <PanelSectionTitle>Edit entry</PanelSectionTitle>

        {isTeam && (
          <>
            <div>
              <FormLabel>Team name</FormLabel>
              <TextInput
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Team name"
                required
              />
            </div>
            <div>
              <FormLabel>Organization</FormLabel>
              <TextInput
                value={form.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                placeholder="Organization"
              />
            </div>
            {allowRosterEdit ? (
              <div>
                <FormLabel>Roster</FormLabel>
                <TextInput
                  value={form.roster}
                  onChange={(e) => patch({ roster: e.target.value })}
                  placeholder={`Comma-separated (${rosterSize ?? 3} players)`}
                />
              </div>
            ) : (
              <p className="text-xs text-text-steel">
                Roster cannot be changed after the group stage has started.
              </p>
            )}
          </>
        )}

        {isPlayer && (
          <>
            <div>
              <FormLabel>Player name</FormLabel>
              <TextInput
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Player name"
                required
              />
            </div>
            <div>
              <FormLabel>Organization</FormLabel>
              <TextInput
                value={form.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                placeholder="Organization"
              />
            </div>
          </>
        )}

        {isDoubles && (
          <>
            <div>
              <FormLabel>Pair name</FormLabel>
              <TextInput
                value={form.pair_name}
                onChange={(e) => patch({ pair_name: e.target.value })}
                placeholder="Optional pair name"
              />
            </div>
            <div>
              <FormLabel>Player A</FormLabel>
              <TextInput
                value={form.player_a}
                onChange={(e) => patch({ player_a: e.target.value })}
                placeholder="Player A"
                required
              />
            </div>
            <div>
              <FormLabel>Player B</FormLabel>
              <TextInput
                value={form.player_b}
                onChange={(e) => patch({ player_b: e.target.value })}
                placeholder="Player B"
                required
              />
            </div>
            <div>
              <FormLabel>Organization</FormLabel>
              <TextInput
                value={form.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                placeholder="Organization"
              />
            </div>
          </>
        )}

        <div>
          <FormLabel>Seeded</FormLabel>
          <SeededSelect
            value={form.seeded}
            onChange={(seeded) => patch({ seeded })}
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={confirming} fullWidth>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={confirming} fullWidth>
            {confirming ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
