import type { KnockoutMatch, KnockoutRound } from '../types'

const ROUND_ORDER: KnockoutRound[] = [
  'r128',
  'r64',
  'r32',
  'r16',
  'quarter',
  'semi',
  'third_place',
  'final',
]

const ALL_ROUNDS = new Set<KnockoutRound>(ROUND_ORDER)

export function isKnockoutRound(value: string): value is KnockoutRound {
  return ALL_ROUNDS.has(value as KnockoutRound)
}

/** Bracket size (players in the round) → stored round id. */
export function knockoutRoundFromBracketSize(bracketSize: number): KnockoutRound {
  if (bracketSize <= 2) return 'final'
  if (bracketSize === 4) return 'semi'
  if (bracketSize === 8) return 'quarter'
  if (bracketSize === 16) return 'r16'
  if (bracketSize === 32) return 'r32'
  if (bracketSize === 64) return 'r64'
  if (bracketSize === 128) return 'r128'
  let p = 2
  while (p < bracketSize) p *= 2
  return knockoutRoundFromBracketSize(p)
}

export function knockoutRoundOrder(round: KnockoutRound): number {
  const idx = ROUND_ORDER.indexOf(round)
  return idx >= 0 ? idx : 999
}

export function compareKnockoutRounds(a: KnockoutRound, b: KnockoutRound): number {
  return knockoutRoundOrder(a) - knockoutRoundOrder(b)
}

export function knockoutRoundTabLabel(round: KnockoutRound): string {
  switch (round) {
    case 'r128':
      return 'R128'
    case 'r64':
      return 'R64'
    case 'r32':
      return 'R32'
    case 'r16':
      return 'R16'
    case 'quarter':
      return 'QF'
    case 'semi':
      return 'SF'
    case 'third_place':
      return '3rd Place'
    case 'final':
      return 'Final'
  }
}

export function knockoutRoundTitle(round: KnockoutRound): string {
  switch (round) {
    case 'r128':
      return 'Round of 128'
    case 'r64':
      return 'Round of 64'
    case 'r32':
      return 'Round of 32'
    case 'r16':
      return 'Round of 16'
    case 'quarter':
      return 'Quarterfinals'
    case 'semi':
      return 'Semifinals'
    case 'third_place':
      return '3rd Place Match'
    case 'final':
      return 'Final'
  }
}

export function knockoutMatchPrefix(round: KnockoutRound): string {
  switch (round) {
    case 'r128':
      return 'R128'
    case 'r64':
      return 'R64'
    case 'r32':
      return 'R32'
    case 'r16':
      return 'R16'
    case 'quarter':
      return 'QUARTERFINAL'
    case 'semi':
      return 'SEMIFINAL'
    case 'third_place':
      return '3RD PLACE'
    case 'final':
      return 'FINAL'
  }
}

/** Map knockout round to set-rules stage (quarters / semis / finals). */
export function setRulesStageForRound(round: KnockoutRound): 'quarters' | 'semis' | 'finals' {
  if (round === 'final' || round === 'third_place') return 'finals'
  if (round === 'semi') return 'semis'
  return 'quarters'
}

export interface KnockoutRoundMatchLike {
  id: string
  round: KnockoutRound | string
  source_match_a_id?: string | null
  source_match_b_id?: string | null
  pending_odd_round?: boolean
  feeder_source_match_ids?: string[]
}

/** Infer tree depth from source links (0 = first knockout round). */
export function inferKnockoutDepths(
  matches: KnockoutRoundMatchLike[],
): Map<string, number> {
  const depth = new Map<string, number>()

  for (const m of matches) {
    if (!m.source_match_a_id && !m.source_match_b_id && !m.pending_odd_round) {
      depth.set(m.id, 0)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const m of matches) {
      if (depth.has(m.id)) continue

      if (m.pending_odd_round && m.feeder_source_match_ids?.length) {
        const feederDepths = m.feeder_source_match_ids.map((id) => depth.get(id))
        if (feederDepths.some((d) => d === undefined)) continue
        depth.set(m.id, Math.max(...(feederDepths as number[])) + 1)
        changed = true
        continue
      }

      const dA = m.source_match_a_id ? depth.get(m.source_match_a_id) : undefined
      const dB = m.source_match_b_id ? depth.get(m.source_match_b_id) : undefined

      if (m.source_match_a_id && dA === undefined) continue
      if (m.source_match_b_id && dB === undefined) continue

      depth.set(m.id, Math.max(dA ?? -1, dB ?? -1) + 1)
      changed = true
    }
  }

  return depth
}

/** Effective round for display, tabs, and sorting — fixes legacy mis-labeled rounds. */
export function resolveEffectiveKnockoutRounds(
  matches: KnockoutRoundMatchLike[],
): Map<string, KnockoutRound> {
  const result = new Map<string, KnockoutRound>()
  if (!matches.length) return result

  for (const m of matches) {
    if (m.round === 'third_place' || m.round === 'final') {
      result.set(m.id, m.round)
    }
  }

  const hasSources = matches.some((m) => m.source_match_a_id || m.source_match_b_id)
  if (hasSources) {
    const depth = inferKnockoutDepths(matches)
    const byDepth = new Map<number, KnockoutRoundMatchLike[]>()
    for (const m of matches) {
      const d = depth.get(m.id)
      if (d === undefined) continue
      byDepth.set(d, [...(byDepth.get(d) ?? []), m])
    }
    for (const [, group] of byDepth) {
      const bracketSize = group.length * 2
      const round = knockoutRoundFromBracketSize(bracketSize)
      for (const m of group) result.set(m.id, round)
    }
  }

  for (const m of matches) {
    if (result.has(m.id)) continue
    const stored = m.round
    if (isKnockoutRound(stored)) {
      const sameStored = matches.filter((x) => x.round === stored)
      const bracketSize = sameStored.length * 2
      if (bracketSize >= 2 && (bracketSize & (bracketSize - 1)) === 0) {
        result.set(m.id, knockoutRoundFromBracketSize(bracketSize))
      } else {
        result.set(m.id, stored)
      }
    }
  }

  return result
}

export function effectiveKnockoutRound(
  match: KnockoutRoundMatchLike,
  matches: KnockoutRoundMatchLike[],
): KnockoutRound {
  const map = resolveEffectiveKnockoutRounds(matches)
  const inferred = map.get(match.id)
  if (inferred) return inferred
  return isKnockoutRound(match.round) ? match.round : 'quarter'
}

export function filterMatchesByKnockoutRound(
  matches: KnockoutMatch[],
  round: KnockoutRound,
): KnockoutMatch[] {
  const effective = resolveEffectiveKnockoutRounds(matches)
  return matches
    .filter((m) => (effective.get(m.id) ?? m.round) === round)
    .sort((a, b) => a.slot - b.slot || a.bracket_side.localeCompare(b.bracket_side))
}

export function firstKnockoutRoundLabel(advancerCount: number): string {
  const bracketSize = nextPowerOf2(Math.max(advancerCount, 2))
  return knockoutRoundTitle(knockoutRoundFromBracketSize(bracketSize)).toLowerCase()
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

export function knockoutRoundFromStageId(stageId: string): KnockoutRound | null {
  if (!stageId.startsWith('knockout-')) return null
  const round = stageId.slice('knockout-'.length)
  return isKnockoutRound(round) ? round : null
}

export function sortKnockoutMatches(matches: KnockoutMatch[]): KnockoutMatch[] {
  const effective = resolveEffectiveKnockoutRounds(matches)
  return [...matches].sort((a, b) => {
    const ra = effective.get(a.id) ?? a.round
    const rb = effective.get(b.id) ?? b.round
    const rd =
      compareKnockoutRounds(
        isKnockoutRound(ra) ? ra : 'quarter',
        isKnockoutRound(rb) ? rb : 'quarter',
      )
    return rd !== 0 ? rd : a.slot - b.slot
  })
}

/** True when any earlier knockout round still has unscored playable matches. */
export function hasPendingEarlierKnockoutRound(
  matches: KnockoutMatch[],
  currentRound: KnockoutRound,
): boolean {
  const effective = resolveEffectiveKnockoutRounds(matches)
  const currentOrder = knockoutRoundOrder(currentRound)
  return matches.some((m) => {
    const r = effective.get(m.id) ?? m.round
    if (!isKnockoutRound(r) || knockoutRoundOrder(r) >= currentOrder) return false
    return (
      m.status !== 'completed' &&
      !!m.entry_a_id &&
      !!m.entry_b_id &&
      m.outcome !== 'bye'
    )
  })
}
