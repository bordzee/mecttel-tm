import type { TournamentEntry } from '../types'
import { getEntryOrganization, isEntrySeeded } from './groupLayout'
import { canAddEntryToGroup } from './groupAssignment'
import { generateRoundRobinPairs, groupLabels } from './roundRobin'

export type LateJoinMode = 'balance' | 'pick' | 'new_group'

export interface GroupSummary {
  groupId: string
  label: string
  entries: TournamentEntry[]
}

function normalizeOrg(org: string | null): string | null {
  if (!org) return null
  const trimmed = org.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function validateLateJoinTarget(
  groupEntries: TournamentEntry[],
  entry: TournamentEntry,
): { ok: boolean; error?: string; warnings: string[] } {
  const warnings: string[] = []
  const check = canAddEntryToGroup(groupEntries, entry)
  if (!check.ok) {
    return { ok: false, error: check.reason, warnings }
  }

  const entryOrg = normalizeOrg(getEntryOrganization(entry))
  if (entryOrg) {
    for (const existing of groupEntries) {
      if (normalizeOrg(getEntryOrganization(existing)) === entryOrg) {
        warnings.push(`Same organization "${getEntryOrganization(entry)}" already in this group`)
        break
      }
    }
  }

  return { ok: true, warnings }
}

function scoreGroupForBalance(group: GroupSummary, entry: TournamentEntry): number {
  let score = group.entries.length * 10
  const entryOrg = normalizeOrg(getEntryOrganization(entry))
  if (entryOrg) {
    for (const existing of group.entries) {
      if (normalizeOrg(getEntryOrganization(existing)) === entryOrg) score += 100
    }
  }
  if (isEntrySeeded(entry)) {
    score += countSeededInGroup(group.entries) * 3
  }
  return score
}

function countSeededInGroup(entries: TournamentEntry[]): number {
  return entries.filter(isEntrySeeded).length
}

/** Suggest the best existing group for a late join (balance / smallest group). */
export function suggestBalanceGroup(
  groups: GroupSummary[],
  entry: TournamentEntry,
): { groupId: string; label: string; warnings: string[] } | null {
  const valid = groups
    .map((g) => ({ g, validation: validateLateJoinTarget(g.entries, entry) }))
    .filter(({ validation }) => validation.ok)

  if (!valid.length) return null

  valid.sort((a, b) => {
    const scoreDiff = scoreGroupForBalance(a.g, entry) - scoreGroupForBalance(b.g, entry)
    if (scoreDiff !== 0) return scoreDiff
    return a.g.label.localeCompare(b.g.label)
  })

  const best = valid[0]
  return {
    groupId: best.g.groupId,
    label: best.g.label,
    warnings: best.validation.warnings,
  }
}

/** RR pairs to create when adding `entryId` to a group with existing members. */
export function newRoundRobinPairsForEntry(
  entryId: string,
  existingEntryIds: string[],
): [string, string][] {
  return generateRoundRobinPairs([entryId, ...existingEntryIds]).filter(
    ([a, b]) => a === entryId || b === entryId,
  )
}

/** Next group label when creating a new group (A, B, …, then G5). */
export function nextGroupLabel(existingLabels: string[]): string {
  const all = groupLabels(Math.max(existingLabels.length + 1, 26))
  for (const label of all) {
    if (!existingLabels.includes(label)) return label
  }
  return `G${existingLabels.length + 1}`
}

export function distributeLateEntriesAcrossGroups(
  groups: GroupSummary[],
  lateCount: number,
): Map<string, number> {
  const additions = new Map<string, number>()
  for (const g of groups) additions.set(g.groupId, 0)

  for (let i = 0; i < lateCount; i++) {
    let bestId = groups[0]?.groupId
    let bestSize = Infinity
    for (const g of groups) {
      const projected = g.entries.length + (additions.get(g.groupId) ?? 0)
      if (projected < bestSize) {
        bestSize = projected
        bestId = g.groupId
      }
    }
    if (bestId) additions.set(bestId, (additions.get(bestId) ?? 0) + 1)
  }
  return additions
}
