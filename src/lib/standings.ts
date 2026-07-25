import type { GroupMatch, KnockoutMatch, StandingRow, TournamentEntry } from '../types'
import { getEntryDisplayName } from './displayNames'

export function computeStandings(
  entryIds: string[],
  matches: (GroupMatch | KnockoutMatch)[],
  entries: Map<string, TournamentEntry>,
): StandingRow[] {
  const stats = new Map<
    string,
    { played: number; wins: number; losses: number; scoreFor: number; scoreAgainst: number }
  >()

  for (const id of entryIds) {
    stats.set(id, { played: 0, wins: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 })
  }

  for (const m of matches) {
    if (m.status !== 'completed' || m.score_a == null || m.score_b == null) continue
    if (!m.entry_a_id || !m.entry_b_id) continue

    const a = stats.get(m.entry_a_id)
    const b = stats.get(m.entry_b_id)
    if (!a || !b) continue

    a.played++
    b.played++
    a.scoreFor += m.score_a
    a.scoreAgainst += m.score_b
    b.scoreFor += m.score_b
    b.scoreAgainst += m.score_a

    if (m.winner_entry_id === m.entry_a_id) {
      a.wins++
      b.losses++
    } else if (m.winner_entry_id === m.entry_b_id) {
      b.wins++
      a.losses++
    }
  }

  const rows: StandingRow[] = entryIds.map((entryId) => {
    const s = stats.get(entryId)!
    const entry = entries.get(entryId)
    return {
      entryId,
      name: entry ? getEntryDisplayName(entry) : 'Unknown',
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      scoreFor: s.scoreFor,
      scoreAgainst: s.scoreAgainst,
      diff: s.scoreFor - s.scoreAgainst,
      rank: 0,
    }
  })

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins
    if (y.diff !== x.diff) return y.diff - x.diff
    return x.name.localeCompare(y.name)
  })

  rows.forEach((row, i) => {
    row.rank = i + 1
  })

  return rows
}

export function applyManualRankOrder(
  rows: StandingRow[],
  rankOrder: string[] | null | undefined,
): StandingRow[] {
  if (!rankOrder?.length) return rows

  const byId = new Map(rows.map((row) => [row.entryId, row]))
  const ordered: StandingRow[] = []

  rankOrder.forEach((entryId, index) => {
    const row = byId.get(entryId)
    if (row) ordered.push({ ...row, rank: index + 1, rankOverridden: true })
  })

  for (const row of rows) {
    if (!rankOrder.includes(row.entryId)) {
      ordered.push({ ...row, rank: ordered.length + 1 })
    }
  }

  return ordered
}

export function resolveGroupStandings(
  entryIds: string[],
  matches: (GroupMatch | KnockoutMatch)[],
  entries: Map<string, TournamentEntry>,
  manualRankOrder?: string[] | null,
): StandingRow[] {
  return applyManualRankOrder(computeStandings(entryIds, matches, entries), manualRankOrder)
}

export function getTopAdvancers(
  standingsByGroup: Map<string, StandingRow[]>,
  advanceCount: number,
): Map<string, StandingRow[]> {
  const result = new Map<string, StandingRow[]>()
  for (const [groupId, rows] of standingsByGroup) {
    result.set(groupId, rows.slice(0, advanceCount))
  }
  return result
}
