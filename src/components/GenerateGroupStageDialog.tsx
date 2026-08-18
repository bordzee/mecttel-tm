import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { KnockoutBracketPicker } from './KnockoutBracketPicker'
import { StartLayoutPicker } from './StartLayoutPicker'
import {
  Button,
  InfoNoteCard,
  PanelSectionTitle,
  WarningBanner,
} from './ui/primitives'
import type { StartLayoutOption } from '../lib/groupLayout'
import type { KnockoutBracketType } from '../types'

export function GenerateGroupStageDialog({
  open,
  onClose,
  entryCountLabel,
  entryCount,
  isBlockBracket,
  allLayoutOptions,
  selectableLayoutOptions,
  startLayoutKey,
  onSelectLayout,
  isLayoutSelectable,
  startPreview,
  startDisabled,
  loading,
  canEditKnockoutBracket,
  knockoutBracket,
  onKnockoutBracketChange,
  onGenerate,
}: {
  open: boolean
  onClose: () => void
  entryCountLabel: string
  entryCount: number
  isBlockBracket: boolean
  allLayoutOptions: StartLayoutOption[]
  selectableLayoutOptions: StartLayoutOption[]
  startLayoutKey?: string
  onSelectLayout: (key: string) => void
  isLayoutSelectable: (option: StartLayoutOption) => boolean
  startPreview: ReturnType<
    typeof import('../lib/matchOutcomes').validateTournamentStart
  > | null
  startDisabled: boolean
  loading: boolean
  canEditKnockoutBracket: boolean
  knockoutBracket: KnockoutBracketType
  onKnockoutBracketChange: (value: KnockoutBracketType) => void
  onGenerate: () => void
}) {
  useEffect(() => {
    if (!open || loading) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4 bg-black/60">
      <button
        type="button"
        className="absolute inset-0 border-0 cursor-default"
        aria-label="Close dialog"
        onClick={() => !loading && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-group-stage-title"
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PanelSectionTitle>Ready to start</PanelSectionTitle>
        <p id="generate-group-stage-title" className="text-sm text-text-steel leading-snug">
          Choose a group layout and generate the group stage when you are ready to go live.
        </p>

        <div className="space-y-3.5 rounded-2xl border border-border-strong bg-navy/40 p-3.5">
          <p className="text-sm font-extrabold text-text-primary">Generate group stage</p>
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-text-steel">Entries</span>
            <span className="font-bold text-text-bluewhite tabular-nums">{entryCountLabel}</span>
          </div>
          {isBlockBracket && selectableLayoutOptions.length === 0 && (
            <WarningBanner>
              Block bracket requires an even number of groups. For {entryCount} entries there is no
              valid even layout — switch to Cross bracket below, or change the entry count.
            </WarningBanner>
          )}
          {isBlockBracket &&
            selectableLayoutOptions.length > 0 &&
            allLayoutOptions.length > selectableLayoutOptions.length && (
              <InfoNoteCard>
                Block knockout needs an even number of groups. Layouts with an odd group count
                (e.g. 3×3) are shown but require a Cross bracket — switch to Cross below or pick an
                even layout above.
              </InfoNoteCard>
            )}
          {allLayoutOptions.length > 0 ? (
            <StartLayoutPicker
              options={allLayoutOptions}
              selectedKey={startLayoutKey}
              onSelect={onSelectLayout}
              isOptionDisabled={(opt) => !isLayoutSelectable(opt)}
            />
          ) : (
            startPreview &&
            !startPreview.ok && <p className="text-sm text-live">{startPreview.error}</p>
          )}
        </div>

        {canEditKnockoutBracket && (
          <KnockoutBracketPicker value={knockoutBracket} onChange={onKnockoutBracketChange} />
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading} fullWidth>
            Cancel
          </Button>
          <Button disabled={startDisabled} onClick={onGenerate} fullWidth>
            {loading ? 'Generating…' : 'Generate group stage'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
