import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { validateLateJoinTarget, type GroupSummary } from '../lib/lateJoinAssignment'
import type { TournamentEntry } from '../types'
import {
  Button,
  ErrorBanner,
  FormLabel,
  PanelSectionTitle,
  SelectInput,
  WarningBanner,
} from './ui/primitives'

export function MoveEntryDialog({
  entry,
  currentGroupLabel,
  groups,
  onConfirm,
  onCancel,
  confirming,
}: {
  entry: TournamentEntry
  currentGroupLabel: string | null
  groups: GroupSummary[]
  onConfirm: (targetGroupId: string) => void
  onCancel: () => void
  confirming?: boolean
}) {
  const [targetGroupId, setTargetGroupId] = useState(groups[0]?.groupId ?? '')

  const validation = useMemo(() => {
    const group = groups.find((g) => g.groupId === targetGroupId)
    if (!group) return { ok: false, error: 'Select a group', warnings: [] as string[] }
    return validateLateJoinTarget(group.entries, entry)
  }, [groups, targetGroupId, entry])

  const targetLabel = groups.find((g) => g.groupId === targetGroupId)?.label

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-entry-title"
      >
        <PanelSectionTitle>Move to another group</PanelSectionTitle>
        <p id="move-entry-title" className="text-sm text-text-steel leading-snug">
          Move this player to a different group. All of their matches in the current group are
          removed and new round-robin matches are created in the target group.
        </p>

        {currentGroupLabel && (
          <p className="text-sm text-text-bluewhite">
            Current group: <span className="font-semibold">Group {currentGroupLabel}</span>
          </p>
        )}

        <div>
          <FormLabel>Target group</FormLabel>
          <SelectInput
            value={targetGroupId}
            onChange={(e) => setTargetGroupId(e.target.value)}
            aria-label="Target group"
          >
            {groups.map((group) => (
              <option key={group.groupId} value={group.groupId}>
                Group {group.label} ({group.entries.length} players)
              </option>
            ))}
          </SelectInput>
        </div>

        {!validation.ok && validation.error && (
          <ErrorBanner>{validation.error}</ErrorBanner>
        )}

        {validation.ok && validation.warnings.length > 0 && (
          <div className="space-y-2">
            {validation.warnings.map((message) => (
              <WarningBanner key={message}>{message}</WarningBanner>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="secondary" onClick={onCancel} disabled={confirming} fullWidth>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(targetGroupId)}
            disabled={confirming || !validation.ok || !targetGroupId}
            fullWidth
          >
            {confirming ? 'Moving…' : targetLabel ? `Move to Group ${targetLabel}` : 'Move'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
