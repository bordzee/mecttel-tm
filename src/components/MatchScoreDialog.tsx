import { createPortal } from 'react-dom'
import { Button, PanelSectionTitle } from './ui/primitives'
import { MatchScoreEntry } from './MatchScoreEntry'
import type { EventType, GroupMatch, KnockoutMatch, TournamentConfig } from '../types'

export function MatchScoreDialog({
  open,
  eventType,
  config,
  match,
  stage = 'group',
  onClose,
  onSave,
}: {
  open: boolean
  eventType: EventType
  config: TournamentConfig
  match: GroupMatch | KnockoutMatch | null
  stage?: 'group' | 'quarters' | 'semis' | 'finals' | 'knockout_early'
  onClose: () => void
  onSave: (data: {
    score_a: number
    score_b: number
    rubber_results: { home: ('W' | 'L' | null)[] } | null
    winner_entry_id: string
    outcome: string
  }) => Promise<void>
}) {
  if (!open || !match) return null

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-score-dialog-title"
        className="relative w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto bg-card border border-border-strong rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="match-score-dialog-title" className="sr-only">
          Enter match score
        </p>
        <PanelSectionTitle>Enter score</PanelSectionTitle>

        <MatchScoreEntry
          eventType={eventType}
          config={config}
          match={match}
          stage={stage}
          onSave={async (data) => {
            await onSave(data)
            onClose()
          }}
        />

        <Button type="button" variant="secondary" onClick={onClose} fullWidth className="mt-3">
          Cancel
        </Button>
      </div>
    </div>,
    document.body,
  )
}
