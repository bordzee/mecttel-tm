import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { KnockoutBracketPicker } from './KnockoutBracketPicker'
import { Button, PanelSectionTitle, WarningBanner } from './ui/primitives'
import { getEntryDisplayName } from '../lib/displayNames'
import { generateKnockoutPairings } from '../lib/knockoutSeeding'
import { getTopAdvancers } from '../lib/standings'
import type { KnockoutBracketType, StandingRow, TournamentEntry } from '../types'

function previewFirstRoundPairings(
  standingsByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  entryMap: Map<string, TournamentEntry>,
  advanceCount: number,
  bracketType: KnockoutBracketType,
): string[] {
  const advancers = getTopAdvancers(standingsByGroup, advanceCount)
  const { tree } = generateKnockoutPairings(
    advancers,
    groupOrder,
    entryMap,
    advanceCount,
    bracketType,
  )

  return tree
    .filter((node) => node.slot.entryAId && node.slot.entryBId)
    .sort((a, b) => a.slot.slot - b.slot.slot || a.key.localeCompare(b.key))
    .map((node) => {
      const a = entryMap.get(node.slot.entryAId!)!
      const b = entryMap.get(node.slot.entryBId!)!
      return `${getEntryDisplayName(a)} vs ${getEntryDisplayName(b)}`
    })
}

function defaultBracketForGroupCount(
  knockoutBracket: KnockoutBracketType,
  groupCount: number,
): KnockoutBracketType {
  const evenGroupsRequired = groupCount % 2 !== 0
  if (evenGroupsRequired && (knockoutBracket === 'block' || knockoutBracket === 'mirror')) {
    return 'cross'
  }
  return knockoutBracket
}

export function GenerateKnockoutDialog({
  open,
  onClose,
  loading,
  mode,
  knockoutBracket,
  groupCount,
  groupOrder,
  standingsByGroup,
  advanceCount,
  entryMap,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  loading: boolean
  mode: 'generate' | 'regenerate'
  knockoutBracket: KnockoutBracketType
  groupCount: number
  groupOrder: string[]
  standingsByGroup: Map<string, StandingRow[]>
  advanceCount: number
  entryMap: Map<string, TournamentEntry>
  onConfirm: (knockoutBracket: KnockoutBracketType) => void
}) {
  const [activeBracket, setActiveBracket] = useState(knockoutBracket)

  useEffect(() => {
    if (open) setActiveBracket(defaultBracketForGroupCount(knockoutBracket, groupCount))
  }, [open, knockoutBracket, groupCount])

  const evenGroupsRequired = groupCount % 2 !== 0
  const selectionInvalid =
    evenGroupsRequired && (activeBracket === 'block' || activeBracket === 'mirror')
  const firstRoundPreview = useMemo(
    () =>
      previewFirstRoundPairings(
        standingsByGroup,
        groupOrder,
        entryMap,
        advanceCount,
        activeBracket,
      ),
    [standingsByGroup, groupOrder, entryMap, advanceCount, activeBracket],
  )
  const title = mode === 'generate' ? 'Generate knockout bracket' : 'Regenerate knockout bracket'
  const confirmLabel = mode === 'generate' ? 'Generate knockout' : 'Regenerate knockout'

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-knockout-title"
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
      >
        <PanelSectionTitle>{title}</PanelSectionTitle>
        <p id="generate-knockout-title" className="text-sm text-text-steel leading-snug">
          Choose cross, block, or mirror seeding for the first knockout round. This is saved on the
          division and used when generating from group ranks.
        </p>

        <KnockoutBracketPicker
          value={activeBracket}
          onChange={setActiveBracket}
          evenGroupsRequired={evenGroupsRequired}
        />

        {evenGroupsRequired && (
          <WarningBanner>
            Block and mirror require an even number of groups ({groupCount} groups now). Use Cross,
            or adjust the group layout before generating knockout.
          </WarningBanner>
        )}

        {firstRoundPreview.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border-strong bg-navy/40 p-3.5">
            <p className="text-sm font-extrabold text-text-primary">
              First knockout round preview
            </p>
            <ul className="space-y-1.5 text-sm text-text-bluewhite">
              {firstRoundPreview.map((pairing) => (
                <li key={pairing}>{pairing}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading} fullWidth>
            Cancel
          </Button>
          <Button
            disabled={loading || selectionInvalid}
            onClick={() => onConfirm(activeBracket)}
            fullWidth
          >
            {loading ? 'Generating…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
