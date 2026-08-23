import { createPortal } from 'react-dom'
import { Button, CaptionText, PanelSectionTitle, TagPill } from './ui/primitives'
import type { TableAnnouncement } from '../lib/tableAssignment'

export function QueueAnnouncementDialog({
  open,
  announcement,
  onClose,
  onEnterScore,
}: {
  open: boolean
  announcement: TableAnnouncement | null
  onClose: () => void
  onEnterScore?: () => void
}) {
  if (!open || !announcement) return null

  const { label, nextMatch, waitingForRest, restReason, noMoreMatches } = announcement

  return createPortal(
    <div className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-announcement-title"
        className="relative w-full max-w-sm bg-card border border-brand-500/50 rounded-2xl p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <PanelSectionTitle>Score saved</PanelSectionTitle>

        {noMoreMatches ? (
          <CaptionText>
            {label} has no more matches queued in this stage.
          </CaptionText>
        ) : nextMatch ? (
          <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-3.5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-300">
              Announce for {label}
            </p>
            <p className="text-base font-bold text-text-primary">
              {nextMatch.homeName} vs {nextMatch.awayName}
            </p>
            {nextMatch.groupLabel && (
              <TagPill>Group {nextMatch.groupLabel}</TagPill>
            )}
            {nextMatch.round && !nextMatch.groupLabel && (
              <TagPill>{nextMatch.round.replace('_', ' ')}</TagPill>
            )}
            {waitingForRest && restReason && (
              <p className="text-sm text-amber">{restReason}</p>
            )}
            {!waitingForRest && (
              <CaptionText>Call both players to {label}.</CaptionText>
            )}
          </div>
        ) : null}

        <div className="grid gap-2">
          {nextMatch && onEnterScore && !waitingForRest && (
            <Button type="button" onClick={onEnterScore} fullWidth>
              Enter score
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            OK
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
