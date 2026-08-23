import { getEntryDisplayName } from './displayNames'
import { hasPendingEarlierKnockoutRound } from './knockoutRounds'
import type { GroupMatch, KnockoutMatch, KnockoutRound, TournamentEntry } from '../types'

/** Max consecutive matches before a rest is required (blocks a 3rd in a row). */
export const MAX_CONSECUTIVE_MATCHES = 2

export interface QueueMatchView {
  matchId: string
  stage: 'group' | 'knockout'
  groupId?: string
  groupLabel?: string
  round?: KnockoutRound
  entryAId: string
  entryBId: string
  homeName: string
  awayName: string
  queuePosition: number
  playable: boolean
  restReason?: string
}

export interface EntryWaitView {
  entryId: string
  name: string
  matchesUntilTurn: number
  reason: string
}

type PlayedMatch = {
  entry_a_id: string | null
  entry_b_id: string | null
  status: string
  completed_at?: string | null
  queue_order?: number
  id: string
}

function entryName(entryMap: Map<string, TournamentEntry>, entryId: string): string {
  const entry = entryMap.get(entryId)
  return entry ? getEntryDisplayName(entry) : 'Unknown player'
}

function sortCompleted<T extends PlayedMatch>(matches: T[]): T[] {
  return matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => {
      if (a.completed_at && b.completed_at) return a.completed_at.localeCompare(b.completed_at)
      if (a.queue_order != null && b.queue_order != null) return a.queue_order - b.queue_order
      return a.id.localeCompare(b.id)
    })
}

export function consecutivePlays(
  entryId: string,
  completed: PlayedMatch[],
): number {
  let count = 0
  for (let i = completed.length - 1; i >= 0; i--) {
    const m = completed[i]!
    if (m.entry_a_id === entryId || m.entry_b_id === entryId) count++
    else break
  }
  return count
}

export function wouldPlayTooSoon(entryId: string, completed: PlayedMatch[]): boolean {
  return consecutivePlays(entryId, completed) >= MAX_CONSECUTIVE_MATCHES
}

function restReasonForMatch(
  m: { entry_a_id: string; entry_b_id: string },
  completed: PlayedMatch[],
  entryMap: Map<string, TournamentEntry>,
): string | undefined {
  const tired: string[] = []
  if (wouldPlayTooSoon(m.entry_a_id, completed)) {
    tired.push(entryName(entryMap, m.entry_a_id))
  }
  if (wouldPlayTooSoon(m.entry_b_id, completed)) {
    tired.push(entryName(entryMap, m.entry_b_id))
  }
  if (!tired.length) return undefined
  return `${tired.join(' & ')} need rest (played ${MAX_CONSECUTIVE_MATCHES} in a row)`
}

function sortPending<T extends { queue_order?: number; id: string }>(pending: T[]): T[] {
  return [...pending].sort(
    (a, b) => (a.queue_order ?? Number.MAX_SAFE_INTEGER) - (b.queue_order ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
  )
}

export function buildOrderedGroupQueue<T extends PlayedMatch & { entry_a_id: string; entry_b_id: string }>(
  pending: T[],
  completed: T[],
): T[] {
  const completedSim = sortCompleted(completed)
  const remaining = sortPending(pending.filter((m) => m.status !== 'completed'))
  const ordered: T[] = []

  while (remaining.length > 0) {
    const idx = remaining.findIndex(
      (m) =>
        !wouldPlayTooSoon(m.entry_a_id, completedSim) &&
        !wouldPlayTooSoon(m.entry_b_id, completedSim),
    )
    const pick = idx >= 0 ? remaining.splice(idx, 1)[0]! : remaining.shift()!
    ordered.push(pick)
    completedSim.push({ ...pick, status: 'completed' } as T)
  }

  return ordered
}

export function buildGroupMatchQueue(
  matches: GroupMatch[],
  entryMap: Map<string, TournamentEntry>,
  groupLabel?: string,
): { ordered: QueueMatchView[]; entryWait: EntryWaitView[] } {
  const completed = sortCompleted(matches)
  const pending = matches.filter((m) => m.status !== 'completed')
  const orderedMatches = buildOrderedGroupQueue(pending, completed)

  const ordered: QueueMatchView[] = orderedMatches.map((m, index) => {
    const playable =
      !wouldPlayTooSoon(m.entry_a_id, completed) &&
      !wouldPlayTooSoon(m.entry_b_id, completed)
    return {
      matchId: m.id,
      stage: 'group',
      groupId: m.group_id,
      groupLabel,
      entryAId: m.entry_a_id,
      entryBId: m.entry_b_id,
      homeName: entryName(entryMap, m.entry_a_id),
      awayName: entryName(entryMap, m.entry_b_id),
      queuePosition: index + 1,
      playable,
      restReason: playable ? undefined : restReasonForMatch(m, completed, entryMap),
    }
  })

  const entryWait = buildEntryWaitList(ordered, entryMap)
  return { ordered, entryWait }
}

export function buildKnockoutMatchQueue(
  matches: KnockoutMatch[],
  entryMap: Map<string, TournamentEntry>,
  activeRound?: KnockoutRound,
): { ordered: QueueMatchView[]; entryWait: EntryWaitView[] } {
  const completed = sortCompleted(
    matches.filter(
      (m): m is KnockoutMatch & { entry_a_id: string; entry_b_id: string } =>
        m.status === 'completed' && !!m.entry_a_id && !!m.entry_b_id,
    ),
  )
  const scorable = matches.filter(
    (m): m is KnockoutMatch & { entry_a_id: string; entry_b_id: string } =>
      m.status !== 'completed' &&
      !!m.entry_a_id &&
      !!m.entry_b_id &&
      m.outcome !== 'bye' &&
      (!activeRound || m.round === activeRound) &&
      !hasPendingEarlierKnockoutRound(matches, m.round),
  )

  const orderedMatches = buildOrderedGroupQueue(scorable, completed)

  const ordered: QueueMatchView[] = orderedMatches.map((m, index) => {
    const playable =
      !wouldPlayTooSoon(m.entry_a_id, completed) &&
      !wouldPlayTooSoon(m.entry_b_id, completed)
    return {
      matchId: m.id,
      stage: 'knockout',
      round: (m as KnockoutMatch).round,
      entryAId: m.entry_a_id,
      entryBId: m.entry_b_id,
      homeName: entryName(entryMap, m.entry_a_id),
      awayName: entryName(entryMap, m.entry_b_id),
      queuePosition: index + 1,
      playable,
      restReason: playable ? undefined : restReasonForMatch(m, completed, entryMap),
    }
  })

  return { ordered, entryWait: buildEntryWaitList(ordered, entryMap) }
}

function buildEntryWaitList(
  ordered: QueueMatchView[],
  entryMap: Map<string, TournamentEntry>,
): EntryWaitView[] {
  const waitByEntry = new Map<string, EntryWaitView>()

  for (const entryId of collectIdleEntryIds(ordered)) {
    const firstIdx = ordered.findIndex(
      (m) => m.entryAId === entryId || m.entryBId === entryId,
    )
    if (firstIdx < 0) continue
    const match = ordered[firstIdx]!
    const matchesUntilTurn = firstIdx
    let reason = matchesUntilTurn === 0 ? 'Up next' : `${matchesUntilTurn} match${matchesUntilTurn === 1 ? '' : 'es'} ahead`
    if (!match.playable && match.restReason) {
      reason = match.restReason
    }
    waitByEntry.set(entryId, {
      entryId,
      name: entryName(entryMap, entryId),
      matchesUntilTurn,
      reason,
    })
  }

  return [...waitByEntry.values()].sort((a, b) => a.matchesUntilTurn - b.matchesUntilTurn)
}

function collectIdleEntryIds(ordered: QueueMatchView[]): string[] {
  const ids = new Set<string>()
  for (const m of ordered) {
    ids.add(m.entryAId)
    ids.add(m.entryBId)
  }
  return [...ids]
}

export function sortGroupMatchesForQueue(matches: GroupMatch[]): GroupMatch[] {
  const completed = matches.filter((m) => m.status === 'completed')
  const pending = matches.filter((m) => m.status !== 'completed')
  return [...completed, ...buildOrderedGroupQueue(pending, completed)]
}
