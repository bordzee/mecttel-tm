import type { KnockoutMatch, KnockoutRound } from '../types'

export const KNOCKOUT_ROUND_TABS: { round: KnockoutRound; label: string }[] = [
  { round: 'quarter', label: 'Quarters' },
  { round: 'semi', label: 'Semis' },
  { round: 'final', label: 'Finals' },
]

export function knockoutRoundFromStageId(stageId: string): KnockoutRound | null {
  if (stageId === 'knockout-quarter') return 'quarter'
  if (stageId === 'knockout-semi') return 'semi'
  if (stageId === 'knockout-final') return 'final'
  return null
}

export function buildKnockoutStageTabs(knockoutMatches: KnockoutMatch[]) {
  return KNOCKOUT_ROUND_TABS.filter(({ round }) =>
    knockoutMatches.some((m) => m.round === round),
  ).map(({ round, label }) => ({
    id: `knockout-${round}`,
    label,
    pendingCount: knockoutMatches.filter(
      (m) =>
        m.round === round &&
        m.status !== 'completed' &&
        m.entry_a_id &&
        m.entry_b_id &&
        m.outcome !== 'bye',
    ).length,
  }))
}

export function isKnockoutStage(stageId: string): boolean {
  return stageId.startsWith('knockout-')
}
