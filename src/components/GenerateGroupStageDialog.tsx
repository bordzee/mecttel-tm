import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { KnockoutBracketPicker } from './KnockoutBracketPicker'
import { StartLayoutPicker } from './StartLayoutPicker'
import {
  Button,
  PanelSectionTitle,
  WarningBanner,
} from './ui/primitives'
import { isLayoutCompatibleWithBlock, type StartLayoutOption } from '../lib/groupLayout'
import type { KnockoutBracketType } from '../types'

export function GenerateGroupStageDialog({
  open,
  onClose,
  entryCountLabel,
  entryCount,
  allLayoutOptions,
  startLayoutKey,
  onSelectLayout,
  advanceCount,
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
  allLayoutOptions: StartLayoutOption[]
  startLayoutKey?: string
  onSelectLayout: (key: string) => void
  advanceCount: number
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
  const [activeBracket, setActiveBracket] = useState(knockoutBracket)

  useEffect(() => {
    if (open) setActiveBracket(knockoutBracket)
  }, [open, knockoutBracket])

  const layoutOptions = useMemo(() => {
    if (activeBracket === 'block') {
      return allLayoutOptions.filter(isLayoutCompatibleWithBlock)
    }
    return allLayoutOptions
  }, [allLayoutOptions, activeBracket])

  useEffect(() => {
    if (!open || !layoutOptions.length) return
    const selectedValid = startLayoutKey && layoutOptions.some((o) => o.key === startLayoutKey)
    if (!selectedValid) {
      onSelectLayout(layoutOptions[0]!.key)
    }
  }, [open, activeBracket, layoutOptions, startLayoutKey, onSelectLayout])

  const handleBracketChange = (value: KnockoutBracketType) => {
    setActiveBracket(value)
    onKnockoutBracketChange(value)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-group-stage-title"
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
      >
        <PanelSectionTitle>Ready to start</PanelSectionTitle>
        <p id="generate-group-stage-title" className="text-sm text-text-steel leading-snug">
          Choose a group layout and generate the group stage when you are ready to go live.
        </p>

        {canEditKnockoutBracket && (
          <KnockoutBracketPicker value={activeBracket} onChange={handleBracketChange} />
        )}

        <div className="space-y-3.5 rounded-2xl border border-border-strong bg-navy/40 p-3.5">
          <p className="text-sm font-extrabold text-text-primary">Generate group stage</p>
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-text-steel">Entries</span>
            <span className="font-bold text-text-bluewhite tabular-nums">{entryCountLabel}</span>
          </div>
          {activeBracket === 'block' && layoutOptions.length === 0 && (
            <WarningBanner>
              Block bracket requires an even number of groups. For {entryCount} entries there is no
              valid even layout — switch to Cross bracket above, or change the entry count.
            </WarningBanner>
          )}
          {layoutOptions.length > 0 ? (
            <StartLayoutPicker
              options={layoutOptions}
              selectedKey={startLayoutKey}
              onSelect={onSelectLayout}
              advanceCount={advanceCount}
            />
          ) : (
            startPreview &&
            !startPreview.ok && <p className="text-sm text-live">{startPreview.error}</p>
          )}
        </div>

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
