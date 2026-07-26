import type { StandingRow } from '../types'
import { ManualRankBadge, ManualRankNote } from './ui/primitives'

const COL = {
  rank: 'w-[38px] shrink-0',
  stat: 'w-[42px] shrink-0',
  diff: 'w-[54px] shrink-0',
} as const

function HeaderCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-center h-full text-[11px] font-bold text-text-steel ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function GroupStandingsTable({
  rows,
  label,
  manualRanks,
  manualRankNote,
  externalHeader,
}: {
  rows: StandingRow[]
  label?: string
  manualRanks?: boolean
  manualRankNote?: string | null
  /** When true, group title + manual badge render above the table (live page design). */
  externalHeader?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-steel">No standings yet.</p>
  }

  const groupTitle = label ? `Group ${label} standings` : 'Standings'

  return (
    <div className="space-y-3">
      {externalHeader && label && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-base font-extrabold text-text-primary">{groupTitle}</h3>
          {manualRanks && <ManualRankBadge />}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {label && !externalHeader && (
          <div className="px-4 py-2.5 bg-card-raised border-b border-border font-semibold text-[13px] text-text-bluewhite flex items-center justify-between gap-2">
            <span>Group {label}</span>
            {manualRanks && <ManualRankBadge />}
          </div>
        )}
        <div className="bg-card-raised h-[38px] flex items-stretch border-b border-border">
          <HeaderCell className={COL.rank}>#</HeaderCell>
          <div className="flex-1 min-w-0 flex items-center px-3 text-[11px] font-bold text-text-steel">
            Player / Team
          </div>
          <HeaderCell className={COL.stat}>W</HeaderCell>
          <HeaderCell className={COL.stat}>L</HeaderCell>
          <HeaderCell className={COL.diff}>+/-</HeaderCell>
        </div>
        {rows.map((row) => {
          const isLeader = row.rank === 1
          return (
            <div
              key={row.entryId}
              className={`flex items-stretch h-[46px] border-t border-border ${
                isLeader ? 'bg-brand-100' : ''
              }`}
            >
              <div className={`${COL.rank} flex items-center justify-center text-sm font-bold text-text-steel tabular-nums`}>
                {row.rank}
              </div>
              <div
                className={`flex-1 min-w-0 flex items-center px-3 text-[15px] font-semibold truncate ${
                  isLeader ? 'text-winner' : 'text-text-bluewhite'
                }`}
              >
                {row.name}
              </div>
              <div className={`${COL.stat} flex items-center justify-center text-sm text-text-bluewhite tabular-nums`}>
                {row.wins}
              </div>
              <div className={`${COL.stat} flex items-center justify-center text-sm text-text-bluewhite tabular-nums`}>
                {row.losses}
              </div>
              <div className={`${COL.diff} flex items-center justify-center text-sm text-text-bluewhite tabular-nums`}>
                {row.diff > 0 ? `+${row.diff}` : row.diff}
              </div>
            </div>
          )
        })}
        {manualRanks && manualRankNote && !externalHeader && (
          <div className="px-4 py-3 bg-amber-soft border-t border-amber/30 text-sm text-text-bluewhite">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber mb-1">
              Why manual ranks?
            </p>
            <p>{manualRankNote}</p>
          </div>
        )}
      </div>

      {externalHeader && manualRanks && manualRankNote && (
        <ManualRankNote>{manualRankNote}</ManualRankNote>
      )}
    </div>
  )
}
