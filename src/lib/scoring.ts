import type { TeamFormat, RubberResult, TournamentConfig } from '../types'
import { WIN_THRESHOLD } from './constants'

export function countRubberWins(rubbers: RubberResult[]): number {
  return rubbers.filter((r) => r === 'W').length
}

export function calculateTieFromRubbers(
  homeRubbers: RubberResult[],
  format: TeamFormat,
): { scoreA: number; scoreB: number; valid: boolean; error?: string } {
  const threshold = WIN_THRESHOLD[format]
  const played = homeRubbers.filter((r) => r !== null) as ('W' | 'L')[]
  let scoreA = 0
  let scoreB = 0

  for (const r of played) {
    if (r === 'W') scoreA++
    else scoreB++
  }

  if (played.length === 0) {
    return { scoreA: 0, scoreB: 0, valid: false, error: 'Mark at least one rubber result' }
  }

  if (scoreA >= threshold && scoreB >= threshold) {
    return { scoreA, scoreB, valid: false, error: 'Both teams cannot reach the win threshold' }
  }

  if (scoreA < threshold && scoreB < threshold) {
    const maxRubbers = format === 'SSDSS' ? 5 : 3
    if (played.length >= maxRubbers) {
      return { scoreA, scoreB, valid: false, error: 'Tie must have a winner after all rubbers played' }
    }
    return {
      scoreA,
      scoreB,
      valid: false,
      error: 'Tie is not complete — a team must reach the win threshold',
    }
  }

  const winnerScore = Math.max(scoreA, scoreB)
  const loserScore = Math.min(scoreA, scoreB)
  const validScores =
    format === 'SSDSS'
      ? ['3-0', '3-1', '3-2'].includes(`${winnerScore}-${loserScore}`)
      : ['2-0', '2-1'].includes(`${winnerScore}-${loserScore}`)

  if (!validScores) {
    return { scoreA, scoreB, valid: false, error: `Invalid tie score ${winnerScore}-${loserScore} for ${format}` }
  }

  return { scoreA, scoreB, valid: true }
}

export function validateSetScore(
  scoreA: number,
  scoreB: number,
  bestOf: 3 | 5 | 7,
): { valid: boolean; error?: string } {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { valid: false, error: 'Scores must be whole numbers' }
  }
  if (scoreA < 0 || scoreB < 0) {
    return { valid: false, error: 'Scores cannot be negative' }
  }

  const winsNeeded = Math.ceil(bestOf / 2)
  const winner = Math.max(scoreA, scoreB)
  const loser = Math.min(scoreA, scoreB)

  if (winner < winsNeeded) {
    return { valid: false, error: `Winner needs at least ${winsNeeded} sets in best of ${bestOf}` }
  }
  if (loser >= winsNeeded) {
    return { valid: false, error: 'Both players cannot reach the set win threshold' }
  }
  if (winner === winsNeeded && loser === winsNeeded - 1) {
    return { valid: true }
  }
  if (winner === winsNeeded && loser < winsNeeded - 1) {
    return { valid: true }
  }
  return { valid: false, error: `Invalid set score ${scoreA}-${scoreB} for best of ${bestOf}` }
}

export function getBestOfForStage(
  stage: 'group' | 'knockout_early' | 'quarters' | 'semis' | 'finals',
  config: TournamentConfig,
): 3 | 5 | 7 {
  return config.set_rules[stage === 'knockout_early' ? 'knockout_early' : stage]
}
