import type { Group, GroupMatch, TournamentEntry } from '../types'
import { buildOrderedGroupQueue } from './matchQueue'
import { computeStandings, resolveGroupStandings } from './standings'

/** Everything the admin needs to show and score one group. */
export function buildGroupStageData(
  groups: Group[],
  members: { group_id: string; entry_id: string }[],
  groupMatches: GroupMatch[],
  entryMap: Map<string, TournamentEntry>,
) {
  return groups.map((group) => {
    const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
    const matches = groupMatches.filter((m) => m.group_id === group.id)
    const completed = matches.filter((m) => m.status === 'completed')
    const pending = buildOrderedGroupQueue(
      matches.filter((m) => m.status !== 'completed'),
      completed,
    )
    return {
      group,
      entryIds,
      matches,
      pending,
      completed,
      computedRows: computeStandings(entryIds, matches, entryMap),
      rows: resolveGroupStandings(entryIds, matches, entryMap, group.manual_rank_order),
      groupPlayComplete: matches.length > 0 && pending.length === 0,
      hasManualRanks: !!group.manual_rank_order?.length,
    }
  })
}

export type GroupStageData = ReturnType<typeof buildGroupStageData>[number]
