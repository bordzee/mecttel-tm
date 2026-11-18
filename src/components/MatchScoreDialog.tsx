import { Button, PanelSectionTitle } from './ui/primitives'
import { MatchScoreEntry } from './MatchScoreEntry'
import type { EventType, GroupMatch, KnockoutMatch, TournamentConfig } from '../types'
import { Modal } from './ui/Modal'

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

  return (
    <Modal
      labelledBy="match-score-dialog-title"
      z="z-[260]"
      panelClassName="w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto bg-card border border-border-strong rounded-2xl p-4 shadow-[var(--shadow-pop)]"
      onClose={onClose}
    >
      <p id="match-score-dialog-title" className="sr-only">
        Enter match score
      </p>
      <PanelSectionTitle>Enter score</PanelSectionTitle>

      <MatchScoreEntry
        bare
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
    </Modal>
  )
}
