import { Button, CaptionText, PanelSectionTitle, TagPill } from './ui/primitives'
import type { TableAnnouncement } from '../lib/tableAssignment'
import { Modal } from './ui/Modal'

export function QueueAnnouncementDialog({
  open,
  announcement,
  title = 'Score saved',
  onClose,
}: {
  open: boolean
  announcement: TableAnnouncement | null
  title?: string
  onClose: () => void
}) {
  if (!open || !announcement) return null

  const { label, nextMatch, waitingForRest, restWaived, restReason, noMoreMatches } = announcement

  return (
    <Modal
      labelledBy="queue-announcement-title"
      z="z-[270]"
      center
      panelClassName="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-[var(--shadow-pop)]"
      onClose={onClose}
    >
      <PanelSectionTitle>{title}</PanelSectionTitle>
      <p id="queue-announcement-title" className="sr-only">
        {title} — next match announcement
      </p>

      {noMoreMatches ? (
        <CaptionText>
          {label} has no more matches queued in this stage.
        </CaptionText>
      ) : nextMatch ? (
        <div className="text-center space-y-2 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">Call to</p>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">{label}</p>
          <p className="text-xl font-medium text-text-primary">{nextMatch.homeName}</p>
          <p className="text-sm text-text-faint">vs</p>
          <p className="text-xl font-medium text-text-primary">{nextMatch.awayName}</p>
          <div className="flex justify-center pt-1">
            {nextMatch.groupLabel && <TagPill>Group {nextMatch.groupLabel}</TagPill>}
            {nextMatch.round && !nextMatch.groupLabel && (
              <TagPill>{nextMatch.round.replace('_', ' ')}</TagPill>
            )}
          </div>
          {waitingForRest && restReason && <p className="text-sm text-amber">{restReason}</p>}
          {restWaived && (
            <p className="text-sm text-amber">
              Rest rule waived: {restReason ?? 'a player is still resting'}. No other match could be played, so this one goes ahead.
            </p>
          )}
        </div>
      ) : null}

      <Button type="button" onClick={onClose} fullWidth>
        OK
      </Button>
    </Modal>
  )
}
