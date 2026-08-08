import { useMemo, useState } from 'react'
import {
  validateLateJoinTarget,
  type GroupSummary,
  type LateJoinMode,
} from '../lib/lateJoinAssignment'
import type { TournamentEntry } from '../types'
import {
  Button,
  ErrorBanner,
  FormLabel,
  InfoNoteCard,
  PanelSectionTitle,
  SegmentedControl,
  SelectInput,
  WarningBanner,
} from './ui/primitives'

export function LateEntryDialog({
  entryLabel,
  groups,
  mockEntry,
  suggestion,
  onConfirm,
  onCancel,
  confirming,
}: {
  entryLabel: string
  groups: GroupSummary[]
  mockEntry: TournamentEntry
  suggestion: { groupId: string; label: string; warnings: string[] } | null
  onConfirm: (mode: LateJoinMode, groupId?: string) => void
  onCancel: () => void
  confirming?: boolean
}) {
  const [mode, setMode] = useState<LateJoinMode>(suggestion ? 'balance' : 'pick')
  const [pickedGroupId, setPickedGroupId] = useState(suggestion?.groupId ?? groups[0]?.groupId ?? '')

  const pickValidation = useMemo(() => {
    const group = groups.find((g) => g.groupId === pickedGroupId)
    if (!group) return { ok: false, error: 'Select a group', warnings: [] as string[] }
    return validateLateJoinTarget(group.entries, mockEntry)
  }, [groups, pickedGroupId, mockEntry])

  const activeWarnings =
    mode === 'balance' && suggestion
      ? suggestion.warnings
      : mode === 'pick' && pickValidation.ok
        ? pickValidation.warnings
        : []

  const pickBlocked = mode === 'pick' && !pickValidation.ok

  const targetLabel =
    mode === 'balance' && suggestion
      ? `Group ${suggestion.label}`
      : mode === 'pick'
        ? groups.find((g) => g.groupId === pickedGroupId)?.label
          ? `Group ${groups.find((g) => g.groupId === pickedGroupId)!.label}`
          : 'Selected group'
        : 'New group'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="late-entry-title"
      >
        <PanelSectionTitle>Late check-in</PanelSectionTitle>
        <p className="text-sm text-text-steel leading-snug">
          Assign <span className="font-bold text-text-bluewhite">{entryLabel}</span> to a group.
          Only missing round-robin matches will be created.
        </p>

        <div className="space-y-2">
          <FormLabel>Assignment</FormLabel>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as LateJoinMode)}
            options={[
              { value: 'balance', label: 'Balance' },
              { value: 'pick', label: 'Pick group' },
              { value: 'new_group', label: 'New group' },
            ]}
            disabledValues={!suggestion ? ['balance'] : []}
          />
        </div>

        {mode === 'balance' && suggestion && (
          <InfoNoteCard>
            Suggested: <strong>Group {suggestion.label}</strong> (smallest / best fit)
          </InfoNoteCard>
        )}

        {mode === 'pick' && (
          <div className="space-y-2">
            <FormLabel>Group</FormLabel>
            <SelectInput value={pickedGroupId} onChange={(e) => setPickedGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  Group {g.label} ({g.entries.length} entries)
                </option>
              ))}
            </SelectInput>
            {pickBlocked && pickValidation.error && (
              <ErrorBanner>{pickValidation.error}</ErrorBanner>
            )}
          </div>
        )}

        {mode === 'new_group' && (
          <InfoNoteCard>
            Creates a separate group with round-robin only among its members. Existing groups stay
            unchanged.
          </InfoNoteCard>
        )}

        {activeWarnings.length > 0 && (
          <WarningBanner>
            <ul className="space-y-1 list-disc list-inside">
              {activeWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </WarningBanner>
        )}

        <p className="text-xs text-text-steel">
          Adding to: <span className="font-semibold text-text-bluewhite">{targetLabel}</span>
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={confirming} fullWidth>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (mode === 'new_group') onConfirm('new_group')
              else if (mode === 'balance' && suggestion) onConfirm('balance', suggestion.groupId)
              else onConfirm('pick', pickedGroupId)
            }}
            disabled={
              confirming ||
              (mode === 'pick' && (!pickedGroupId || pickBlocked)) ||
              (mode === 'balance' && !suggestion)
            }
            fullWidth
          >
            {confirming ? 'Adding…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
