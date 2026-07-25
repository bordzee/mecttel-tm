import type { TournamentEntry } from '../types'
import { getEntryOrganization, isEntrySeeded, entrySortKey } from './groupLayout'
import { groupLabels } from './roundRobin'

export interface GroupAssignment {
  label: string
  entryIds: string[]
}

export interface AssignmentWarning {
  type: 'org_sibling' | 'seeded_clash'
  message: string
}

export function assignEntriesToGroups(
  entries: TournamentEntry[],
  groupCount: number,
  groupSizes?: number[],
): { groups: GroupAssignment[]; warnings: AssignmentWarning[] } {
  const sorted = [...entries].sort((a, b) => entrySortKey(a) - entrySortKey(b))
  const labels = groupLabels(groupCount)
  const buckets: TournamentEntry[][] = labels.map(() => [])

  if (groupSizes) {
    if (groupSizes.length !== groupCount || groupSizes.reduce((a, b) => a + b, 0) !== sorted.length) {
      throw new Error('Group sizes do not match entry count')
    }
    let entryIdx = 0
    let round = 0
    while (entryIdx < sorted.length) {
      const order =
        round % 2 === 0
          ? [...Array(groupCount).keys()]
          : [...Array(groupCount).keys()].reverse()
      for (const g of order) {
        if (entryIdx >= sorted.length) break
        if (buckets[g].length < groupSizes[g]) {
          buckets[g].push(sorted[entryIdx++])
        }
      }
      round++
    }
  } else {
    for (let i = 0; i < sorted.length; i++) {
      const round = Math.floor(i / groupCount)
      const pos = i % groupCount
      const groupIndex = round % 2 === 0 ? pos : groupCount - 1 - pos
      buckets[groupIndex].push(sorted[i])
    }
  }

  const warnings: AssignmentWarning[] = []
  for (const bucket of buckets) {
    const orgs = new Map<string, string[]>()
    let seededCount = 0
    for (const entry of bucket) {
      if (isEntrySeeded(entry)) seededCount++
      const org = getEntryOrganization(entry)
      if (!org) continue
      if (!orgs.has(org)) orgs.set(org, [])
      orgs.get(org)!.push(entry.id)
    }
    for (const [org, ids] of orgs) {
      if (ids.length > 1) {
        warnings.push({
          type: 'org_sibling',
          message: `Same organization "${org}" has ${ids.length} entries in one group`,
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

  return {
    groups: labels.map((label, i) => ({
      label,
      entryIds: buckets[i].map((e) => e.id),
    })),
    warnings,
  }
}
