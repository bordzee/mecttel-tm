import { PanelSectionTitle, TagPill } from './ui/primitives'
import type { EntryWaitView, QueueMatchView } from '../lib/matchQueue'

export function MatchQueuePanel({
  title = 'Match queue',
  ordered,
  entryWait,
  showWaiting = true,
}: {
  title?: string
  ordered: QueueMatchView[]
  entryWait: EntryWaitView[]
  showWaiting?: boolean
}) {
  if (ordered.length === 0) return null

  const upNext = ordered.filter((m) => m.playable).slice(0, 3)
  const onDeck = ordered.filter((m) => !m.playable)
  const waitingEntries = entryWait.filter((e) => e.matchesUntilTurn > 0 || e.reason.includes('rest'))

  return (
    <section className="space-y-3">
      <PanelSectionTitle>{title}</PanelSectionTitle>

      {upNext.length > 0 && (
        <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-3.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-300">Up next</p>
          <ul className="space-y-2">
            {upNext.map((m) => (
              <li key={m.matchId} className="text-sm text-text-bluewhite">
                <span className="font-bold text-text-primary">
                  {m.homeName} vs {m.awayName}
                </span>
                {m.groupLabel && (
                  <span className="block text-xs text-text-steel mt-0.5">Group {m.groupLabel}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onDeck.length > 0 && (
        <div className="rounded-xl border border-border bg-card-raised p-3.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-steel">On deck (rest)</p>
          <ul className="space-y-2">
            {onDeck.slice(0, 4).map((m) => (
              <li key={m.matchId} className="text-sm">
                <p className="font-semibold text-text-bluewhite">
                  {m.homeName} vs {m.awayName}
                </p>
                {m.restReason && (
                  <p className="text-xs text-amber mt-0.5">{m.restReason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showWaiting && waitingEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-navy/40 p-3.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-steel">Waiting</p>
          <ul className="space-y-1.5">
            {waitingEntries.slice(0, 8).map((e) => (
              <li key={e.entryId} className="flex items-start justify-between gap-2 text-sm">
                <span className="font-semibold text-text-bluewhite truncate">{e.name}</span>
                <TagPill>{e.reason}</TagPill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
