import { useEffect, useMemo, useState } from 'react'
import type { StandingRow } from '../types'
import { Button, CaptionText, Card, FormLabel, SelectInput, SubsectionTitle, TextInput } from './ui/primitives'

interface Props {
  groupLabel: string
  rows: StandingRow[]
  manualRankOrder?: string[] | null
  manualRankNote?: string | null
  onSave: (orderedEntryIds: string[], note: string | null) => Promise<void>
  onClear?: () => Promise<void>
  saving?: boolean
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
    <Card className="p-4 space-y-3">
      <div>
        <SubsectionTitle>Set group ranks — Group {groupLabel}</SubsectionTitle>
        <CaptionText>
          If paper head-to-head changes the order, pick rank 1, 2, 3… here and save before generating
          knockout. W/L and +/− stay from match scores.
        </CaptionText>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.entryId}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{row.name}</p>
              <p className="text-xs text-slate-500">
                {row.wins}W–{row.losses}L · {row.diff > 0 ? `+${row.diff}` : row.diff} sets
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
        <CaptionText>Shown on the live page when manual ranks are saved.</CaptionText>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save ranks'}
        </Button>
        {hasManualSaved && onClear && (
          <Button type="button" variant="secondary" onClick={onClear} disabled={saving}>
            Reset to auto
          </Button>
        )}
      </div>

      {hasManualSaved && (
        <CaptionText>Manual ranks saved — knockout uses these positions.</CaptionText>
      )}
    </Card>
  )
}
