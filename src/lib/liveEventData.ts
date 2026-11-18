import type { Group, GroupMatch, KnockoutMatch, TournamentEntry, TournamentEvent } from '../types'
import {
  fetchEntries,
  fetchEvent,
  fetchGroupMatches,
  fetchGroupMembers,
  fetchGroups,
  fetchKnockoutMatches,
} from './tournamentService'

export interface LiveEventData {
  event: TournamentEvent
  groups: Group[]
  groupMatches: GroupMatch[]
  knockoutMatches: KnockoutMatch[]
  members: { group_id: string; entry_id: string }[]
  entries: TournamentEntry[]
}

/**
 * Loader for pages that follow a division live.
 *
 * Every score change used to re-download the whole division, including every
 * participant (each one is several documents). Participants almost never change, so
 * they are reused between live updates, and re-read when
 *  - a match mentions someone not loaded yet (late check-in),
 *  - the cached copy is older than \`maxEntryAgeMs\` (catches renames), or
 *  - the caller forces a full load (first load).
 * Groups, matches and the division itself are always read fresh.
 */
export function createLiveEventLoader(options: { withMembers: boolean; maxEntryAgeMs?: number }) {
  const maxAge = options.maxEntryAgeMs ?? 60_000
  let cache: { key: string; entries: TournamentEntry[]; at: number } | null = null

  return async function load(
    tournamentId: string,
    eventId: string,
    loadOptions?: { force?: boolean },
  ): Promise<LiveEventData> {
    const [event, groups, groupMatches, knockoutMatches] = await Promise.all([
      fetchEvent(tournamentId, eventId),
      fetchGroups(tournamentId, eventId),
      fetchGroupMatches(tournamentId, eventId),
      fetchKnockoutMatches(tournamentId, eventId),
    ])
    const members = options.withMembers
      ? (await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))).map((m) => ({
          group_id: m.group_id,
          entry_id: m.entry_id,
        }))
      : []

    const needed = new Set<string>()
    for (const m of groupMatches) {
      needed.add(m.entry_a_id)
      needed.add(m.entry_b_id)
    }
    for (const m of knockoutMatches) {
      if (m.entry_a_id) needed.add(m.entry_a_id)
      if (m.entry_b_id) needed.add(m.entry_b_id)
    }
    for (const m of members) needed.add(m.entry_id)

    const key = `${tournamentId}/${eventId}`
    const known = cache && cache.key === key ? new Set(cache.entries.map((e) => e.id)) : null
    const reusable =
      !loadOptions?.force &&
      cache != null &&
      known != null &&
      Date.now() - cache.at < maxAge &&
      [...needed].every((id) => known.has(id))

    let entries: TournamentEntry[]
    if (reusable && cache) {
      entries = cache.entries
    } else {
      entries = await fetchEntries(tournamentId, eventId)
      cache = { key, entries, at: Date.now() }
    }

    return { event, groups, groupMatches, knockoutMatches, members, entries }
  }
}
