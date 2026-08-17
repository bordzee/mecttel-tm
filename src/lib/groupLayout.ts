import type { GroupLayoutOption, TournamentEntry } from '../types'

/** Preferred minimum when the entry count allows it. */
export const MIN_PER_GROUP = 3
/** Absolute minimum for one group in an uneven layout (e.g. 11 → 3+3+3+2). */
export const ABSOLUTE_MIN_PER_GROUP = 2
export const MAX_PER_GROUP = 8

export interface StartLayoutOption {
  key: string
  label: string
  groupCount: number
  entriesPerGroup: number
  groupSizes?: number[]
  uneven: boolean
}

export interface ResolvedGroupLayout {
  entriesPerGroup: number
  groupCount: number
  groupSizes?: number[]
  uneven: boolean
  adjustedFromPreferred: boolean
}

export function getGroupLayoutOptions(totalEntries: number): GroupLayoutOption[] {
  if (totalEntries < 2) return []

  const options: GroupLayoutOption[] = []
  const maxPerGroup = Math.min(MAX_PER_GROUP, totalEntries)

  for (let perGroup = MIN_PER_GROUP; perGroup <= maxPerGroup; perGroup++) {
    if (totalEntries % perGroup === 0) {
      const groupCount = totalEntries / perGroup
      if (groupCount >= 2) {
        options.push({ entriesPerGroup: perGroup, groupCount })
      }
    }
  }

  return options
}

/** Split `count` entries across `groupCount` groups (each 2–8; prefer 3+). */
export function distributeGroupSizes(count: number, groupCount: number): number[] | null {
  if (groupCount < 2) return null
  if (count < groupCount * ABSOLUTE_MIN_PER_GROUP || count > groupCount * MAX_PER_GROUP) return null

  const baseMin =
    count >= groupCount * MIN_PER_GROUP ? MIN_PER_GROUP : ABSOLUTE_MIN_PER_GROUP
  const sizes = new Array(groupCount).fill(baseMin)
  let remaining = count - groupCount * baseMin
  let i = 0
  while (remaining > 0) {
    const idx = i % groupCount
    if (sizes[idx] >= MAX_PER_GROUP) return null
    sizes[idx]++
    remaining--
    i++
  }
  return sizes
}

export function layoutIncludesGroupOfTwo(groupSizes?: number[]): boolean {
  return groupSizes != null && groupSizes.some((size) => size === ABSOLUTE_MIN_PER_GROUP)
}

export function getUnevenGroupLayouts(entryCount: number): { groupCount: number; sizes: number[] }[] {
  const layouts: { groupCount: number; sizes: number[] }[] = []
  const maxGroups = Math.floor(entryCount / ABSOLUTE_MIN_PER_GROUP)
  for (let g = 2; g <= maxGroups; g++) {
    const sizes = distributeGroupSizes(entryCount, g)
    if (sizes) layouts.push({ groupCount: g, sizes })
  }
  return layouts
}

function formatSizesLabel(sizes: number[]): string {
  return sizes.join('+')
}

function layoutScore(
  groupCount: number,
  entriesPerGroup: number,
  preferredPerGroup?: number,
  preferredGroupCount?: number,
): number {
  let score = 0
  if (preferredGroupCount != null && groupCount === preferredGroupCount) score += 20
  if (preferredPerGroup != null) score -= Math.abs(entriesPerGroup - preferredPerGroup)
  return score
}

/** Block bracket requires an even number of groups after the group stage. */
export function isLayoutCompatibleWithBlock(option: Pick<StartLayoutOption, 'groupCount'>): boolean {
  return option.groupCount % 2 === 0
}

export function getStartLayoutOptions(
  entryCount: number,
  config: { entries_per_group?: number; group_count?: number },
): StartLayoutOption[] {
  const options: StartLayoutOption[] = []

  for (const even of getGroupLayoutOptions(entryCount)) {
    options.push({
      key: `even-${even.entriesPerGroup}`,
      label: `${even.groupCount} groups × ${even.entriesPerGroup}`,
      groupCount: even.groupCount,
      entriesPerGroup: even.entriesPerGroup,
      uneven: false,
    })
  }

  for (const uneven of getUnevenGroupLayouts(entryCount)) {
    const allEqual = uneven.sizes.every((s) => s === uneven.sizes[0])
    if (allEqual) continue // same as "N groups × M" even layout
    const maxSize = Math.max(...uneven.sizes)
    options.push({
      key: `uneven-${uneven.sizes.join('-')}`,
      label: `${uneven.groupCount} groups (${formatSizesLabel(uneven.sizes)})`,
      groupCount: uneven.groupCount,
      entriesPerGroup: maxSize,
      groupSizes: uneven.sizes,
      uneven: true,
    })
  }

  return options.sort(
    (a, b) =>
      layoutScore(b.groupCount, b.entriesPerGroup, config.entries_per_group, config.group_count) -
      layoutScore(a.groupCount, a.entriesPerGroup, config.entries_per_group, config.group_count),
  )
}

/** Entry counts near `count` that can form valid equal groups. */
export function getNearestValidEntryCounts(count: number, limit = 4): number[] {
  const results: number[] = []
  for (let delta = 1; delta <= 12 && results.length < limit; delta++) {
    const higher = count + delta
    const lower = count - delta
    if (lower >= 2 && getStartLayoutOptions(lower, {}).length && !results.includes(lower)) {
      results.push(lower)
    }
    if (getStartLayoutOptions(higher, {}).length && !results.includes(higher)) {
      results.push(higher)
    }
  }
  return results.sort((a, b) => Math.abs(a - count) - Math.abs(b - count))
}

function findStartLayoutOption(
  options: StartLayoutOption[],
  overrideEntriesPerGroup?: number,
  overrideLayoutKey?: string,
): StartLayoutOption | undefined {
  if (overrideLayoutKey) {
    return options.find((o) => o.key === overrideLayoutKey)
  }
  if (overrideEntriesPerGroup != null) {
    return options.find((o) => !o.uneven && o.entriesPerGroup === overrideEntriesPerGroup)
  }
  return options[0]
}

/** Resolve group layout from actual registered entries (may differ from max capacity). */
export function resolveGroupLayoutForStart(
  entryCount: number,
  config: { entries_per_group?: number; group_count?: number },
  overrideEntriesPerGroup?: number,
  overrideLayoutKey?: string,
): { ok: true; layout: ResolvedGroupLayout } | { ok: false; error: string; suggestions: number[] } {
  const options = getStartLayoutOptions(entryCount, config)
  if (!options.length) {
    return {
      ok: false,
      error: `${entryCount} entries cannot be grouped (need 2–8 per group, at least 2 groups).`,
      suggestions: [],
    }
  }

  const chosen = findStartLayoutOption(options, overrideEntriesPerGroup, overrideLayoutKey)
  if (!chosen) {
    return {
      ok: false,
      error: 'Selected group layout is not valid for this entry count.',
      suggestions: getNearestValidEntryCounts(entryCount),
    }
  }

  const preferredEven =
    config.entries_per_group != null &&
    entryCount % config.entries_per_group === 0 &&
    config.entries_per_group === chosen.entriesPerGroup &&
    !chosen.uneven

  return {
    ok: true,
    layout: {
      entriesPerGroup: chosen.entriesPerGroup,
      groupCount: chosen.groupCount,
      groupSizes: chosen.groupSizes,
      uneven: chosen.uneven,
      adjustedFromPreferred:
        !preferredEven &&
        (config.entries_per_group != null || config.group_count != null) &&
        (config.entries_per_group !== chosen.entriesPerGroup ||
          config.group_count !== chosen.groupCount ||
          chosen.uneven),
    },
  }
}

export function getEntryOrganization(entry: TournamentEntry): string | null {
  if (entry.entry_type === 'team') return entry.team?.organization ?? null
  if (entry.entry_type === 'player') return entry.player?.organization ?? null
  if (entry.entry_type === 'pair') return entry.pair?.organization ?? null
  return null
}

export function isEntrySeeded(entry: TournamentEntry): boolean {
  if (entry.seeded === true) return true
  if (entry.entry_type === 'team') return entry.team?.seeded === true
  if (entry.entry_type === 'player') return entry.player?.seeded === true
  if (entry.entry_type === 'pair') return entry.pair?.seeded === true
  return false
}

export function entrySortKey(entry: TournamentEntry): number {
  if (isEntrySeeded(entry)) return 0
  if (entry.seeded === false) return 1
  return 2
}

export function parseSeededValue(value: FormDataEntryValue | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}
