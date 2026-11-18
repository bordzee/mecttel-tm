import { useEffect, useMemo, useState } from 'react'
import { KnockoutBracketPicker } from './KnockoutBracketPicker'
import { StartLayoutPicker } from './StartLayoutPicker'
import {
  Button,
  PanelSectionTitle,
  WarningBanner,
} from './ui/primitives'
import { isLayoutCompatibleWithBlock, type StartLayoutOption } from '../lib/groupLayout'
import type { KnockoutBracketType } from '../types'
import { Modal } from './ui/Modal'

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
    if (activeBracket === 'block' || activeBracket === 'mirror') {
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

  // Mirror is the default, but some entry counts only fit an odd number of groups.
  // Switch to cross for those instead of leaving the admin with no layout to pick.
  const [switchedToCross, setSwitchedToCross] = useState(false)
  useEffect(() => {
    if (!open) {
      setSwitchedToCross(false)
      return
    }
    const needsEven = activeBracket === 'block' || activeBracket === 'mirror'
    if (
      needsEven &&
      canEditKnockoutBracket &&
      allLayoutOptions.length > 0 &&
      !allLayoutOptions.some(isLayoutCompatibleWithBlock)
    ) {
      setActiveBracket('cross')
      onKnockoutBracketChange('cross')
      setSwitchedToCross(true)
    }
  }, [open, activeBracket, canEditKnockoutBracket, allLayoutOptions, onKnockoutBracketChange])

  const handleBracketChange = (value: KnockoutBracketType) => {
    setActiveBracket(value)
    onKnockoutBracketChange(value)
  }

  if (!open) return null

  return (
    <Modal
      labelledBy="generate-group-stage-title"
      z="z-[250]"
      scrimDismiss={false}
      onClose={loading ? undefined : onClose}
      panelClassName="w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-[var(--shadow-pop)] max-h-[90vh] overflow-y-auto"
    >
      <PanelSectionTitle>Ready to start</PanelSectionTitle>
      <p id="generate-group-stage-title" className="text-sm text-text-steel leading-snug">
        Choose a group layout and generate the group stage when you are ready to go live.
      </p>

      {canEditKnockoutBracket && (
        <KnockoutBracketPicker value={activeBracket} onChange={handleBracketChange} />
      )}

      <div className="space-y-3.5 rounded-2xl border border-border-strong bg-navy/40 p-3.5">
        <p className="text-sm font-semibold text-text-primary">Generate group stage</p>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold text-text-steel">Entries</span>
          <span className="font-semibold text-text-bluewhite tabular-nums">{entryCountLabel}</span>
        </div>
        {switchedToCross && (
          <WarningBanner>
            {entryCount} entries only fit an odd number of groups, so the knockout type was switched
            from mirror to cross.
          </WarningBanner>
        )}
        {(activeBracket === 'block' || activeBracket === 'mirror') && layoutOptions.length === 0 && (
          <WarningBanner>
            Block and mirror brackets require an even number of groups. For {entryCount} entries
            there is no valid even layout — switch to Cross above, or change the entry count.
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
          !startPreview.ok && <p className="text-sm text-danger">{startPreview.error}</p>
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
    </Modal>
  )
}
