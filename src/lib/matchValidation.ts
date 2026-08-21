import type { EventType, GroupMatch, KnockoutMatch, RubberResults, TournamentConfig } from '../types'
import { calculateTieFromRubbers, getBestOfForStage, validateSetScore } from './scoring'

export interface MatchResultPayload {
  score_a: number
  score_b: number
  rubber_results?: RubberResults | null
  winner_entry_id: string
  outcome: string
}

export function validateMatchResultSave(
  match: GroupMatch | KnockoutMatch,
  update: MatchResultPayload,
  options: {
    eventType: EventType
    config: TournamentConfig
    stage: 'group' | 'quarters' | 'semis' | 'finals'
    /** Allow correcting an already-scored match (group stage only). */
    allowEdit?: boolean
  },
): void {
  if (match.status === 'completed' && !options.allowEdit) {
    throw new Error('This match is already completed')
  }

  if (!match.entry_a_id || !match.entry_b_id) {
    throw new Error('Both entries must be set before scoring')
  }

  if (
    update.winner_entry_id !== match.entry_a_id &&
    update.winner_entry_id !== match.entry_b_id
  ) {
    throw new Error('Winner must be one of the match entries')
  }

  if (options.eventType === 'team' && options.config.team_format) {
    const home = update.rubber_results?.home ?? []
    const tie = calculateTieFromRubbers(home, options.config.team_format)
    if (!tie.valid) {
      throw new Error(tie.error ?? 'Invalid rubber results')
    }
    if (tie.scoreA !== update.score_a || tie.scoreB !== update.score_b) {
      throw new Error('Rubber results do not match the tie score')
    }
    const expectedWinner =
      tie.scoreA > tie.scoreB ? match.entry_a_id : match.entry_b_id
    if (update.winner_entry_id !== expectedWinner) {
      throw new Error('Winner does not match rubber results')
    }
    return
  }

  const bestOf = getBestOfForStage(options.stage, options.config)
  const result = validateSetScore(update.score_a, update.score_b, bestOf)
  if (!result.valid) {
    throw new Error(result.error ?? 'Invalid set score')
  }

  const winnerIsA = update.score_a > update.score_b
  const expectedWinner = winnerIsA ? match.entry_a_id : match.entry_b_id
  if (update.winner_entry_id !== expectedWinner) {
    throw new Error('Winner does not match the set score')
  }
}
