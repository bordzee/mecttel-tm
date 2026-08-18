import { useEffect, useMemo, useState } from 'react'
import type { StandingRow } from '../types'
import {
  Button,
  CaptionText,
  FormLabel,
  InfoNoteCard,
  PanelSectionTitle,
  SelectInput,
  TextActionButton,
  TextInput,
} from './ui/primitives'
import { StatusPopups } from './ui/StatusPopups'

interface Props {
  groupLabel: string
  rows: StandingRow[]
  manualRankOrder?: string[] | null
  manualRankNote?: string | null
  onSave: (orderedEntryIds: string[], note: string | null) => Promise<void>
  onClear?: () => Promise<void>
  saving?: boolean
  disabled?: boolean
  diffLabel?: string
}

function initialRanks(rows: StandingRow[], manualRankOrder?: string[] | null): Record<string, number> {
  const ranks: Record<string, number> = {}
  if (manualRankOrder?.length) {
    manualRankOrder.forEach((entryId, index) => {
      ranks[entryId] = index + 1
    })
    return ranks
  }
  rows.forEach((row) => {
    ranks[row.entryId] = row.rank
  })
  return ranks
}

export function GroupRankEditor({
  groupLabel,
  rows,
  manualRankOrder,
  manualRankNote,
  onSave,
  onClear,
  saving = false,
  disabled = false,
  diffLabel = 'sets',
}: Props) {
  const [ranks, setRanks] = useState<Record<string, number>>(() => initialRanks(rows, manualRankOrder))
  const [note, setNote] = useState(manualRankNote ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    setRanks(initialRanks(rows, manualRankOrder))
    setNote(manualRankNote ?? '')
    setError('')
  }, [rows, manualRankOrder, manualRankNote])

  const rankOptions = useMemo(
    () => Array.from({ length: rows.length }, (_, i) => i + 1),
    [rows.length],
  )

  const hasManualSaved = !!manualRankOrder?.length

  const handleSave = async () => {
    setError('')
    const values = rows.map((row) => ranks[row.entryId]).filter((v) => v != null)
    const unique = new Set(values)
    if (values.length !== rows.length || unique.size !== rows.length) {
      setError('Assign a unique rank to every player or team')
      return
    }

    const orderedEntryIds = [...rows]
      .sort((a, b) => ranks[a.entryId] - ranks[b.entryId])
      .map((row) => row.entryId)

    await onSave(orderedEntryIds, note.trim() || null)
  }

  return (
    <div className="space-y-3">
      <div className="bg-card border border-amber rounded-2xl p-4 space-y-3.5">
        <div>
          <PanelSectionTitle>Set group ranks — Group {groupLabel}</PanelSectionTitle>
          <CaptionText className="mt-1">
            Tie-break needed — set the final order when wins and point difference are equal.
          </CaptionText>
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.entryId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-raised px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-bluewhite truncate">{row.name}</p>
                <p className="text-xs text-text-steel">
                  {row.wins}W–{row.losses}L · {row.diff > 0 ? `+${row.diff}` : row.diff} {diffLabel}
                </p>
              </div>
              <div className="shrink-0 w-20">
                <SelectInput
                  value={ranks[row.entryId] ?? row.rank}
                  onChange={(e) =>
                    setRanks((prev) => ({
                      ...prev,
                      [row.entryId]: parseInt(e.target.value, 10),
                    }))
                  }
                  aria-label={`Rank for ${row.name}`}
                >
                  {rankOptions.map((rank) => (
                    <option key={rank} value={rank}>
                      #{rank}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>
          ))}
        </div>

        <div>
          <FormLabel>Note for viewers (optional)</FormLabel>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Head-to-head on paper — Martin over Bordz"
            maxLength={280}
          />
        </div>

        {error ? (
          <StatusPopups error={error} onErrorDismiss={() => setError('')} />
        ) : null}

        <Button type="button" onClick={handleSave} disabled={saving || disabled} fullWidth>
          {saving ? 'Saving…' : 'Save ranks'}
        </Button>

        {hasManualSaved && onClear && (
          <TextActionButton onClick={onClear} disabled={saving} className="w-full">
            Reset to auto
          </TextActionButton>
        )}
      </div>

      {hasManualSaved && (
        <InfoNoteCard>Saved. The knockout will use these positions.</InfoNoteCard>
      )}
    </div>
  )
}
