import type { KnockoutMatch, KnockoutRound } from '../types'
import {
  compareKnockoutRounds,
  effectiveKnockoutRound,
  filterMatchesByKnockoutRound,
  isKnockoutRound,
  knockoutRoundFromStageId,
  knockoutRoundTabLabel,
  resolveEffectiveKnockoutRounds,
} from './knockoutRounds'

export { knockoutRoundFromStageId } from './knockoutRounds'

export function buildKnockoutStageTabs(knockoutMatches: KnockoutMatch[]) {
  const effective = resolveEffectiveKnockoutRounds(knockoutMatches)
  const roundsPresent = [
    ...new Set(
      knockoutMatches.map((m) => effective.get(m.id) ?? m.round).filter(isKnockoutRound),
    ),
  ].sort(compareKnockoutRounds)

  return roundsPresent.map((round) => ({
    id: `knockout-${round}`,
    label: knockoutRoundTabLabel(round),
    pendingCount: knockoutMatches.filter((m) => {
      const r = effective.get(m.id) ?? m.round
      return (
        r === round &&
        m.status !== 'completed' &&
        m.entry_a_id &&
        m.entry_b_id &&
        m.outcome !== 'bye'
      )
    }).length,
  }))
}

export function isKnockoutStage(stageId: string): boolean {
  return stageId.startsWith('knockout-')
}

export function filterKnockoutMatchesForStage(
  knockoutMatches: KnockoutMatch[],
  stageId: string,
): KnockoutMatch[] {
  const round = knockoutRoundFromStageId(stageId)
  if (!round) return []
  return filterMatchesByKnockoutRound(knockoutMatches, round)
}

export function matchEffectiveRound(
  match: KnockoutMatch,
  allMatches: KnockoutMatch[],
): KnockoutRound {
  return effectiveKnockoutRound(match, allMatches)
}
