import {
  getEntryOrganization,
  getEntrySeededFilterStatus,
  entrySortKey,
} from './groupLayout'
import { getComparableNames, normalizeEntryName } from './entryValidation'
import type { TournamentEntry } from '../types'

export function buildParticipantOrgOptions(entries: TournamentEntry[]): string[] {
  const names = new Set<string>()
  for (const entry of entries) {
    const org = getEntryOrganization(entry)
    if (org?.trim()) names.add(org.trim())
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function filterParticipants(
  entries: TournamentEntry[],
  search: string,
  filter: string,
): TournamentEntry[] {
  const query = normalizeEntryName(search)
  return entries.filter((entry) => {
    if (query) {
      const matchesSearch = getComparableNames(entry).some((name) => name.includes(query))
      if (!matchesSearch) return false
    }
    if (filter === 'all') return true
    if (filter === 'seeded') return getEntrySeededFilterStatus(entry) === 'seeded'
    if (filter === 'non-seeded') return getEntrySeededFilterStatus(entry) === 'non-seeded'
    if (filter === 'not-set') return getEntrySeededFilterStatus(entry) === 'not-set'
    if (filter.startsWith('org:')) {
      return getEntryOrganization(entry) === filter.slice(4)
    }
    return true
  })
}

export function sortParticipants(entries: TournamentEntry[]): TournamentEntry[] {
  return [...entries].sort((a, b) => entrySortKey(a) - entrySortKey(b))
}

export function participantFilterLabel(filter: string): string {
  if (filter === 'all') return 'All'
  if (filter === 'seeded') return 'Seeded'
  if (filter === 'non-seeded') return 'Non-seeded'
  if (filter === 'not-set') return 'Seeded not set'
  if (filter.startsWith('org:')) return filter.slice(4)
  return 'Filter'
}
