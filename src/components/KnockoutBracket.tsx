import type { KnockoutMatch, KnockoutRound } from '../types'
import { compareKnockoutRounds, effectiveKnockoutRound, isKnockoutRound, knockoutMatchPrefix, knockoutRoundTitle, resolveEffectiveKnockoutRounds } from '../lib/knockoutRounds'
import { getEntryDisplayName } from '../lib/displayNames'
import { PanelSectionTitle } from './ui/primitives'
import { MatchCard } from './MatchCard'

function roundLabel(round: KnockoutRound): string {
  return knockoutRoundTitle(round)
}

function entryName(match: KnockoutMatch, side: 'a' | 'b'): string {
  const entry = side === 'a' ? match.entry_a : match.entry_b
  if (entry) return getEntryDisplayName(entry)
  if (side === 'b' && match.outcome === 'bye') return 'BYE'
  if (side === 'a' && !entry && match.is_odd_play_in) return 'Winner play-in'
  if (side === 'a' && !entry && match.pending_odd_round) return 'Top seed (bye)'
  if (side === 'b' && !entry && match.pending_odd_round) return 'TBD'
  return 'TBD'
}

export function knockoutMatchLabel(
  match: KnockoutMatch,
  index: number,
  allMatches?: KnockoutMatch[],
): string {
  if (match.is_odd_play_in) {
    return match.status === 'completed' ? 'PLAY-IN · COMPLETED' : 'PLAY-IN · PENDING'
  }

  const round =
    allMatches && allMatches.length > 0
      ? effectiveKnockoutRound(match, allMatches)
      : match.round
  const roundPrefix = knockoutMatchPrefix(round)

  if (match.outcome === 'bye') return `${roundPrefix} ${index + 1} · BYE`
  if (match.pending_odd_round) return `${roundPrefix} ${index + 1} · AWAITING`
  return `${roundPrefix} ${index + 1}`
}

function MatchRow({
  match,
  index,
  allMatches,
}: {
  match: KnockoutMatch
  index: number
  allMatches: KnockoutMatch[]
}) {
  const label = knockoutMatchLabel(match, index, allMatches)
  const aWon = match.winner_entry_id === match.entry_a_id
  const bWon = match.winner_entry_id === match.entry_b_id
  const isBye = match.outcome === 'bye'
  const completed = match.status === 'completed' && !isBye
  const awaiting = match.pending_odd_round && match.status !== 'completed'

  if (completed) {
    return (
      <MatchCard
        label={label}
        homeName={entryName(match, 'a')}
        awayName={entryName(match, 'b')}
        scoreA={match.score_a}
        scoreB={match.score_b}
        homeWon={aWon}
        awayWon={bWon}
      />
    )
  }

  const labelClass = isBye
    ? 'text-winner'
    : awaiting
      ? 'text-text-steel'
      : 'text-text-steel'

  return (
    <div
      className={`bg-card rounded-xl border p-3.5 space-y-2.5 ${
        awaiting ? 'border-border' : 'border-border'
      }`}
    >
      <p className={`text-[11px] font-bold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-semibold truncate ${
            awaiting ? 'text-text-steel' : 'text-text-bluewhite'
          }`}
        >
          {entryName(match, 'a')}
        </span>
        {!isBye && !awaiting && match.score_a != null && (
          <span className="text-lg font-extrabold text-text-primary tabular-nums">{match.score_a}</span>
        )}
        {awaiting && <span className="text-lg font-extrabold text-text-steel tabular-nums">–</span>}
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate text-text-steel">{entryName(match, 'b')}</span>
        {!isBye && !awaiting && match.score_b != null && (
          <span className="text-lg font-extrabold text-text-steel tabular-nums">{match.score_b}</span>
        )}
        {awaiting && <span className="text-lg font-extrabold text-text-steel tabular-nums">–</span>}
      </div>
    </div>
  )
}

export function KnockoutBracket({
  matches,
  round,
  allMatches,
  hideRoundTitle = false,
}: {
  matches: KnockoutMatch[]
  round?: KnockoutRound
  /** Full knockout list — used to infer correct round labels on legacy brackets. */
  allMatches?: KnockoutMatch[]
  hideRoundTitle?: boolean
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-text-steel">Knockout bracket not generated yet.</p>
  }

  const context = allMatches ?? matches

  const list = (
    <div className="space-y-2.5">
      {matches.map((match, index) => (
        <MatchRow key={match.id} match={match} index={index} allMatches={context} />
      ))}
    </div>
  )

  if (round) {
    return (
      <section className={hideRoundTitle ? undefined : 'space-y-3'}>
        {!hideRoundTitle && <PanelSectionTitle>{roundLabel(round)}</PanelSectionTitle>}
        {list}
      </section>
    )
  }

  const effective = resolveEffectiveKnockoutRounds(context)
  const rounds = [
    ...new Set(matches.map((m) => effective.get(m.id) ?? m.round).filter(isKnockoutRound)),
  ].sort(compareKnockoutRounds)

  return (
    <div className="space-y-6">
      {rounds.map((r) => {
        const items = matches.filter((m) => (effective.get(m.id) ?? m.round) === r)
        return (
          <section key={r} className="space-y-3">
            {!hideRoundTitle && <PanelSectionTitle>{roundLabel(r)}</PanelSectionTitle>}
            <div className="space-y-2.5">
              {items.map((match, index) => (
                <MatchRow key={match.id} match={match} index={index} allMatches={context} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
