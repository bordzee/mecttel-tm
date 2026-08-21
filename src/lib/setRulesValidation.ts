import type { EventType, GroupMatch, KnockoutMatch, SetRules, TournamentConfig } from '../types'
import { effectiveKnockoutRound, knockoutRoundTitle, setRulesStageForRound } from './knockoutRounds'
import { getBestOfForStage, validateSetScore } from './scoring'

function validateCompletedMatchScore(
  scoreA: number,
  scoreB: number,
  bestOf: 3 | 5 | 7,
  label: string,
): string | null {
  const result = validateSetScore(scoreA, scoreB, bestOf)
  if (!result.valid) {
    return `${label}: completed score ${scoreA}-${scoreB} is not valid for best of ${bestOf}`
  }
  return null
}

/** Block set-rule changes that would invalidate already-scored non-team matches. */
export function validateSetRulesAgainstCompletedMatches(
  eventType: EventType,
  setRules: SetRules,
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[],
): string | null {
  if (eventType === 'team') return null

  const config = { set_rules: setRules } as TournamentConfig

  for (const match of groupMatches) {
    if (match.status !== 'completed' || match.outcome !== 'normal') continue
    if (match.score_a == null || match.score_b == null) continue
    const error = validateCompletedMatchScore(
      match.score_a,
      match.score_b,
      setRules.group,
      'Group stage',
    )
    if (error) return error
  }

  for (const match of knockoutMatches) {
    if (match.status !== 'completed' || match.outcome !== 'normal') continue
    if (match.score_a == null || match.score_b == null) continue

    const round = effectiveKnockoutRound(match, knockoutMatches)
    const stage = setRulesStageForRound(round)
    const bestOf = getBestOfForStage(stage, config)
    const roundLabel = knockoutRoundTitle(round)

    const error = validateCompletedMatchScore(
      match.score_a,
      match.score_b,
      bestOf,
      roundLabel,
    )
    if (error) return error
  }

  return null
}
