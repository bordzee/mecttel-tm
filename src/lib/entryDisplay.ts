import { fetchTeamRosters } from '../lib/tournamentService'
import type { TournamentEntry } from '../types'

/** Load team player names keyed by team id (for public participant lists). */
export async function loadTeamRostersByTeamId(
  entries: TournamentEntry[],
): Promise<Map<string, string[]>> {
  const teamIds = entries.filter((e) => e.team_id).map((e) => e.team_id!)
  if (!teamIds.length) return new Map()

  const rosterRows = await fetchTeamRosters(teamIds)
  const map = new Map<string, string[]>()
  for (const row of rosterRows) {
    const list = map.get(row.team_id) ?? []
    list.push(row.name)
    map.set(row.team_id, list)
  }
  return map
}
