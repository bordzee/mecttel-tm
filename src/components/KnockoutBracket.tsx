import type { KnockoutMatch, KnockoutRound } from '../types'
import { getEntryDisplayName } from '../lib/displayNames'
import { SubsectionTitle } from './ui/primitives'

function roundLabel(round: KnockoutRound): string {
  if (round === 'quarter') return 'Quarters'
  if (round === 'semi') return 'Semis'
  return 'Final'
}

function entryName(match: KnockoutMatch, side: 'a' | 'b'): string {
  const entry = side === 'a' ? match.entry_a : match.entry_b
  if (entry) return getEntryDisplayName(entry)
  if (side === 'b' && match.outcome === 'bye') return 'BYE'
  return 'TBD'
}

function MatchRow({ match }: { match: KnockoutMatch }) {
  const aWon = match.winner_entry_id === match.entry_a_id
  const bWon = match.winner_entry_id === match.entry_b_id
  const isBye = match.outcome === 'bye'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium truncate ${aWon ? 'text-winner' : 'text-slate-900'}`}>
          {entryName(match, 'a')}
        </span>
        {!isBye && match.score_a != null && (
          <span className="text-sm font-bold text-slate-900 tabular-nums">{match.score_a}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium truncate ${bWon ? 'text-winner' : 'text-slate-900'}`}>
          {entryName(match, 'b')}
        </span>
        {!isBye && match.score_b != null && (
          <span className="text-sm font-bold text-slate-900 tabular-nums">{match.score_b}</span>
        )}
      </div>
      {isBye && <p className="text-xs text-slate-400">Bye</p>}
      {match.is_odd_play_in && <p className="text-xs text-slate-400">Play-in</p>}
      {match.pending_odd_round && <p className="text-xs text-slate-400">Pending play-in</p>}
    </div>
  )
}

export function KnockoutBracket({
  matches,
  round,
}: {
  matches: KnockoutMatch[]
  round?: KnockoutRound
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500">Knockout bracket not generated yet.</p>
  }

  if (round) {
    return (
      <section>
        <SubsectionTitle>{roundLabel(round)}</SubsectionTitle>
        <div className="space-y-2 mt-3">
          {matches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      </section>
    )
  }

  const rounds: KnockoutRound[] = ['quarter', 'semi', 'final']
  const grouped = rounds
    .map((r) => ({ round: r, items: matches.filter((m) => m.round === r) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      {grouped.map(({ round: r, items }) => (
        <section key={r}>
          <SubsectionTitle>{roundLabel(r)}</SubsectionTitle>
          <div className="space-y-2 mt-3">
            {items.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
