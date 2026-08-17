import type { TournamentEntry } from '../types'
import { getEntryDisplayName } from './displayNames'
import { getEntryOrganization, isEntrySeeded, entrySortKey } from './groupLayout'
import { groupLabels } from './roundRobin'

export interface GroupAssignment {
  label: string
  entryIds: string[]
}

export interface AssignmentWarning {
  type: 'org_sibling' | 'seeded_clash' | 'seeded_same_org'
  message: string
}

export interface GroupAssignmentResult {
  groups: GroupAssignment[]
  warnings: AssignmentWarning[]
  error?: string
}

function normalizeOrg(org: string | null): string | null {
  if (!org) return null
  const trimmed = org.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function countSeededInGroup(entries: TournamentEntry[]): number {
  return entries.filter(isEntrySeeded).length
}

function seededOrgsInGroup(entries: TournamentEntry[]): Set<string> {
  const orgs = new Set<string>()
  for (const entry of entries) {
    if (!isEntrySeeded(entry)) continue
    const org = normalizeOrg(getEntryOrganization(entry))
    if (org) orgs.add(org)
  }
  return orgs
}

/** Hard rules: max 2 seeded per group; no 2 seeded from the same org. */
export function canAddEntryToGroup(
  groupEntries: TournamentEntry[],
  entry: TournamentEntry,
): { ok: true } | { ok: false; reason: string } {
  if (!isEntrySeeded(entry)) return { ok: true }

  const seededCount = countSeededInGroup(groupEntries)
  if (seededCount >= 2) {
    return { ok: false, reason: 'This group already has 2 seeded entries' }
  }

  const entryOrg = normalizeOrg(getEntryOrganization(entry))
  if (entryOrg && seededOrgsInGroup(groupEntries).has(entryOrg)) {
    return { ok: false, reason: 'This group already has a seeded entry from the same organization' }
  }

  return { ok: true }
}

/** Check whether seeded entries can be placed across `groupCount` groups. */
export function validateSeededPlacementPossible(
  entries: TournamentEntry[],
  groupCount: number,
): string | null {
  const seeded = entries.filter(isEntrySeeded)
  if (seeded.length > groupCount * 2) {
    return `Cannot assign groups: ${seeded.length} seeded entries need at most 2 per group across ${groupCount} groups. Choose a layout with more groups or change seeded flags.`
  }

  const byOrg = new Map<string, number>()
  for (const entry of seeded) {
    const org = normalizeOrg(getEntryOrganization(entry))
    if (!org) continue
    byOrg.set(org, (byOrg.get(org) ?? 0) + 1)
  }

  for (const [org, count] of byOrg) {
    if (count > groupCount) {
      return `Cannot assign groups: ${count} seeded entries from "${org}" need at least ${count} groups (max 1 seeded per group from the same org). Choose a layout with more groups or change seeded flags.`
    }
  }

  return null
}

function collectWarnings(buckets: TournamentEntry[][]): AssignmentWarning[] {
  const warnings: AssignmentWarning[] = []
  /** Peak same-org count in any one group — one summary warning per org. */
  const orgPeakInGroup = new Map<string, number>()

  for (const bucket of buckets) {
    const orgCounts = new Map<string, number>()
    let seededCount = 0
    const seededOrgCounts = new Map<string, number>()

    for (const entry of bucket) {
      if (isEntrySeeded(entry)) {
        seededCount++
        const org = normalizeOrg(getEntryOrganization(entry))
        if (org) seededOrgCounts.set(org, (seededOrgCounts.get(org) ?? 0) + 1)
      }
      const org = getEntryOrganization(entry)
      if (!org) continue
      const key = org.trim()
      orgCounts.set(key, (orgCounts.get(key) ?? 0) + 1)
    }

    for (const [org, count] of orgCounts) {
      if (count > 1) {
        orgPeakInGroup.set(org, Math.max(orgPeakInGroup.get(org) ?? 0, count))
      }
    }
    for (const [org, count] of seededOrgCounts) {
      if (count > 1) {
        warnings.push({
          type: 'seeded_same_org',
          message: `${count} seeded entries from "${org}" in the same group`,
        })
      }
    }
    if (seededCount > 1) {
      warnings.push({
        type: 'seeded_clash',
        message: `${seededCount} seeded entries in the same group — may meet before final`,
      })
    }
  }

  for (const [org, peak] of orgPeakInGroup) {
    warnings.push({
      type: 'org_sibling',
      message: `Organization "${org}" has up to ${peak} entries in one group — siblings may meet before the final`,
    })
  }

  return warnings
}

function snakePreferredIndex(entryIndex: number, groupCount: number): number {
  const round = Math.floor(entryIndex / groupCount)
  const pos = entryIndex % groupCount
  return round % 2 === 0 ? pos : groupCount - 1 - pos
}

function scoreGroupForEntry(
  groupEntries: TournamentEntry[],
  entry: TournamentEntry,
  preferredIndex: number,
  groupIndex: number,
  targetSize: number,
): number {
  let score = groupEntries.length * 10
  if (groupIndex === preferredIndex) score -= 5

  const entryOrg = normalizeOrg(getEntryOrganization(entry))
  if (entryOrg) {
    for (const existing of groupEntries) {
      if (normalizeOrg(getEntryOrganization(existing)) === entryOrg) score += 8
    }
  }

  if (groupEntries.length >= targetSize) score += 1000
  return score
}

function assignSmart(
  sorted: TournamentEntry[],
  groupCount: number,
  groupSizes?: number[],
): GroupAssignmentResult {
  const placementError = validateSeededPlacementPossible(sorted, groupCount)
  if (placementError) {
    return { groups: [], warnings: [], error: placementError }
  }

  const labels = groupLabels(groupCount)
  const buckets: TournamentEntry[][] = labels.map(() => [])
  const targets = groupSizes ?? new Array(groupCount).fill(Math.ceil(sorted.length / groupCount))

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const preferred = snakePreferredIndex(i, groupCount)

    const candidates = [...Array(groupCount).keys()].sort((a, b) => {
      const scoreA = scoreGroupForEntry(buckets[a], entry, preferred, a, targets[a])
      const scoreB = scoreGroupForEntry(buckets[b], entry, preferred, b, targets[b])
      return scoreA - scoreB
    })

    let placed = false
    for (const g of candidates) {
      if (buckets[g].length >= targets[g]) continue
      const check = canAddEntryToGroup(buckets[g], entry)
      if (!check.ok) continue
      buckets[g].push(entry)
      placed = true
      break
    }

    if (!placed) {
      return {
        groups: [],
        warnings: [],
        error: `Cannot assign "${getEntryDisplayName(entry)}" — no group satisfies seeded and size rules. Adjust seeded flags or choose a different layout.`,
      }
    }
  }

  return {
    groups: labels.map((label, i) => ({
      label,
      entryIds: buckets[i].map((e) => e.id),
    })),
    warnings: collectWarnings(buckets),
  }
}

export function assignEntriesToGroups(
  entries: TournamentEntry[],
  groupCount: number,
  groupSizes?: number[],
): GroupAssignmentResult {
  if (groupSizes) {
    if (groupSizes.length !== groupCount || groupSizes.reduce((a, b) => a + b, 0) !== entries.length) {
      return { groups: [], warnings: [], error: 'Group sizes do not match entry count' }
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const keyDiff = entrySortKey(a) - entrySortKey(b)
    return keyDiff !== 0 ? keyDiff : a.id.localeCompare(b.id)
  })

  return assignSmart(sorted, groupCount, groupSizes)
}
