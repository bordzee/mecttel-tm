import type { MatchOutcome, TeamFormat, TournamentConfig } from '../types'
import { WIN_THRESHOLD } from './constants'
import { resolveGroupLayoutForStart } from './groupLayout'

export function forfeitScores(
  isTeamEvent: boolean,
  format: TeamFormat | undefined,
  bestOf: 3 | 5 | 7,
): { scoreA: number; scoreB: number } {
  if (isTeamEvent && format) {
    const wins = WIN_THRESHOLD[format]
    return { scoreA: 0, scoreB: wins }
  }
  const wins = Math.ceil(bestOf / 2)
  return { scoreA: 0, scoreB: wins }
}

export function applyOutcomeToScores(
  outcome: MatchOutcome,
  isTeamEvent: boolean,
  format: TeamFormat | undefined,
  bestOf: 3 | 5 | 7,
  winnerIsA: boolean,
  actualScores?: { scoreA: number; scoreB: number },
): { scoreA: number; scoreB: number } {
  if (outcome === 'normal' && actualScores) return actualScores

  const { scoreA: forfeitA, scoreB: forfeitB } = forfeitScores(isTeamEvent, format, bestOf)
  const wins = winnerIsA ? { scoreA: forfeitB, scoreB: forfeitA } : { scoreA: forfeitA, scoreB: forfeitB }

  if (outcome === 'normal' || outcome === 'dq') return wins
  if (outcome === 'forfeit' || outcome === 'no_show') return wins
  return { scoreA: forfeitB, scoreB: forfeitA }
}

export function validateTournamentStart(
  entryCount: number,
  config: TournamentConfig,
  overrideLayoutKey?: string,
  overrideEntriesPerGroup?: number,
): {
  ok: boolean
  error?: string
  groupCount?: number
  entriesPerGroup?: number
  groupSizes?: number[]
  uneven?: boolean
  adjusted?: boolean
  suggestions?: number[]
} {
  if (entryCount < 2) return { ok: false, error: 'Need at least 2 entries to start' }
  if (entryCount > config.total_slots) {
    return { ok: false, error: `Too many entries (${entryCount}) for ${config.total_slots} max slots` }
  }

  const resolved = resolveGroupLayoutForStart(
    entryCount,
    config,
    overrideEntriesPerGroup,
    overrideLayoutKey,
  )
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, suggestions: resolved.suggestions }
  }

  const { layout } = resolved
  const minGroupSize = layout.groupSizes ? Math.min(...layout.groupSizes) : layout.entriesPerGroup

  if (config.advance_count > minGroupSize) {
    return {
      ok: false,
      error: `Advance count (${config.advance_count}) exceeds smallest group size (${minGroupSize})`,
    }
  }

  const knockoutTeams = layout.groupCount * config.advance_count
  if (knockoutTeams < 2) {
    return { ok: false, error: 'Knockout needs at least 2 advancing teams' }
  }

  const bracketType = config.knockout_bracket ?? 'cross'
  if (bracketType === 'block' && layout.groupCount % 2 !== 0) {
    return {
      ok: false,
      error: `Block bracket requires an even number of groups (${layout.groupCount} planned)`,
    }
  }

  return {
    ok: true,
    groupCount: layout.groupCount,
    entriesPerGroup: layout.entriesPerGroup,
    groupSizes: layout.groupSizes,
    uneven: layout.uneven,
    adjusted: layout.adjustedFromPreferred,
  }
}
