import type { EventType, TournamentEntry } from '../types'
import { getEntryDisplayName } from './displayNames'

export function normalizeEntryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** All comparable name strings for an entry (for duplicate checks). */
export function getComparableNames(entry: TournamentEntry): string[] {
  const names: string[] = []
  if (entry.entry_type === 'team' && entry.team?.name) {
    names.push(normalizeEntryName(entry.team.name))
  }
  if (entry.entry_type === 'player' && entry.player?.name) {
    names.push(normalizeEntryName(entry.player.name))
  }
  if (entry.entry_type === 'pair' && entry.pair) {
    if (entry.pair.pair_name) names.push(normalizeEntryName(entry.pair.pair_name))
    names.push(normalizeEntryName(entry.pair.player_a))
    names.push(normalizeEntryName(entry.pair.player_b))
  }
  return names.filter(Boolean)
}

export interface DuplicateGroup {
  normalizedName: string
  displayName: string
  entryIds: string[]
}

/** Find duplicate names already in the entry list. */
export function findDuplicateGroups(entries: TournamentEntry[]): DuplicateGroup[] {
  const byName = new Map<string, { displayName: string; entryIds: string[] }>()

  for (const entry of entries) {
    for (const raw of getComparableNames(entry)) {
      const existing = byName.get(raw)
      const label = getEntryDisplayName(entry)
      if (existing) {
        if (!existing.entryIds.includes(entry.id)) existing.entryIds.push(entry.id)
      } else {
        byName.set(raw, { displayName: label, entryIds: [entry.id] })
      }
    }
  }

  const groups: DuplicateGroup[] = []
  for (const [normalizedName, { displayName, entryIds }] of byName) {
    if (entryIds.length > 1) {
      groups.push({ normalizedName, displayName, entryIds })
    }
  }

  // Also flag when the same person name appears on multiple entries (e.g. two singles entries)
  const playerNameToEntries = new Map<string, string[]>()
  for (const entry of entries) {
    if (entry.entry_type === 'player' && entry.player?.name) {
      const key = normalizeEntryName(entry.player.name)
      const ids = playerNameToEntries.get(key) ?? []
      ids.push(entry.id)
      playerNameToEntries.set(key, ids)
    }
    if (entry.entry_type === 'pair' && entry.pair) {
      for (const p of [entry.pair.player_a, entry.pair.player_b]) {
        const key = normalizeEntryName(p)
        const ids = playerNameToEntries.get(key) ?? []
        if (!ids.includes(entry.id)) ids.push(entry.id)
        playerNameToEntries.set(key, ids)
      }
    }
  }
  for (const [normalizedName, entryIds] of playerNameToEntries) {
    if (entryIds.length > 1 && !groups.some((g) => g.normalizedName === normalizedName)) {
      const first = entries.find((e) => e.id === entryIds[0])
      groups.push({
        normalizedName,
        displayName: first ? getEntryDisplayName(first) : normalizedName,
        entryIds,
      })
    }
  }

  return groups
}

export function duplicateEntryWarnings(entries: TournamentEntry[]): string[] {
  return findDuplicateGroups(entries).map((g) => {
    const labels = g.entryIds
      .map((id) => entries.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => getEntryDisplayName(e!))
    const unique = [...new Set(labels)]
    return `Duplicate name "${g.displayName}" appears on ${unique.length} entries — remove extras before starting`
  })
}

export type NewEntryInput =
  | { type: 'team'; name: string; roster: string[] }
  | { type: 'player'; name: string }
  | {
      type: 'pair'
      pair_name: string
      player_a: string
      player_b: string
    }

export function validateNewEntry(
  entries: TournamentEntry[],
  _eventType: EventType,
  input: NewEntryInput,
): string | null {
  if (input.type === 'player') {
    const name = normalizeEntryName(input.name)
    if (!name) return 'Name is required'
    for (const entry of entries) {
      if (entry.entry_type === 'player' && entry.player) {
        if (normalizeEntryName(entry.player.name) === name) {
          return `Duplicate player: "${input.name.trim()}" is already registered`
        }
      }
      if (entry.entry_type === 'pair' && entry.pair) {
        if (
          normalizeEntryName(entry.pair.player_a) === name ||
          normalizeEntryName(entry.pair.player_b) === name
        ) {
          return `"${input.name.trim()}" is already registered in a doubles pair`
        }
      }
    }
    return null
  }

  if (input.type === 'team') {
    const name = normalizeEntryName(input.name)
    if (!name) return 'Team name is required'
    for (const entry of entries) {
      if (entry.entry_type === 'team' && entry.team) {
        if (normalizeEntryName(entry.team.name) === name) {
          return `Duplicate team: "${input.name.trim()}" is already registered`
        }
      }
    }
    return null
  }

  if (input.type === 'pair') {
    const a = normalizeEntryName(input.player_a)
    const b = normalizeEntryName(input.player_b)
    if (!a || !b) return 'Both player names are required'
    if (a === b) return 'Player A and Player B must be different people'

    const pairKey = [a, b].sort().join('|')
    for (const entry of entries) {
      if (entry.entry_type === 'pair' && entry.pair) {
        const existingKey = [
          normalizeEntryName(entry.pair.player_a),
          normalizeEntryName(entry.pair.player_b),
        ]
          .sort()
          .join('|')
        if (existingKey === pairKey) {
          return `This pair is already registered`
        }
      }
      if (entry.entry_type === 'player' && entry.player) {
        const pn = normalizeEntryName(entry.player.name)
        if (pn === a || pn === b) {
          return `"${pn === a ? input.player_a : input.player_b}" is already registered as a singles entry`
        }
      }
    }

    if (input.pair_name.trim()) {
      const pn = normalizeEntryName(input.pair_name)
      for (const entry of entries) {
        if (entry.entry_type === 'pair' && entry.pair?.pair_name) {
          if (normalizeEntryName(entry.pair.pair_name) === pn) {
            return `Pair name "${input.pair_name.trim()}" is already used`
          }
        }
      }
    }
    return null
  }

  return null
}

/** Block starting if duplicate names exist. */
export function hasBlockingDuplicates(entries: TournamentEntry[], _eventType: EventType): boolean {
  return findDuplicateGroups(entries).length > 0
}
