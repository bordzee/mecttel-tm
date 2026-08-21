import type { StandingRow, TournamentEntry, KnockoutBracketType, KnockoutRound } from '../types'
import { getEntryOrganization, isEntrySeeded } from './groupLayout'
import {
  compareKnockoutRounds,
  firstKnockoutRoundLabel,
  isKnockoutRound,
  knockoutRoundFromBracketSize,
  knockoutRoundTitle,
  resolveEffectiveKnockoutRounds,
} from './knockoutRounds'

export interface KnockoutSlot {
  round: KnockoutRound
  slot: number
  bracketSide: 'left' | 'right'
  entryAId: string | null
  entryBId: string | null
  /** Pre-completed bye — top seed skips first round */
  isBye?: boolean
  winnerEntryId?: string | null
  /** Set when writing to Firestore (internal tree wiring). */
  sourceAKey?: string | null
  sourceBKey?: string | null
  /** Filled when an odd feeder count needs strength-based bye + play-in. */
  pendingOddRound?: boolean
  feederSourceKeys?: string[]
  /** Play-in among the non-bye winners when pendingOddRound is set. */
  isOddPlayIn?: boolean
}

export interface KnockoutTreeNode {
  key: string
  slot: KnockoutSlot
}

export interface SeedingWarning {
  message: string
}

interface Pairing {
  a: StandingRow
  b: StandingRow
  side: 'left' | 'right'
  /** Group rank 0 = #1, 1 = #2 — used for validation only. */
  rankA: number
  rankB: number
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

/** Standard bracket seed line (1 vs N, 2 vs N-1, …). */
export function getBracketSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 2) return [1, 2]
  const half = getBracketSeedOrder(bracketSize / 2)
  const result: number[] = []
  for (const s of half) {
    result.push(s)
    result.push(bracketSize + 1 - s)
  }
  return result
}

function sideForSlot(slotIndex: number, totalSlots: number): 'left' | 'right' {
  return slotIndex < totalSlots / 2 ? 'left' : 'right'
}

function collectAllAdvancers(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  advanceCount: number,
): StandingRow[] {
  const rows: StandingRow[] = []
  for (let r = 0; r < advanceCount; r++) {
    for (const gid of groupOrder) {
      const row = advancersByGroup.get(gid)?.[r]
      if (row) rows.push(row)
    }
  }
  return rows
}

export function compareStandingStrength(a: StandingRow, b: StandingRow): number {
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.diff !== a.diff) return b.diff - a.diff
  return a.name.localeCompare(b.name)
}

/** True when every group has rank #1 and #2 to pair across groups. */
function supportsGroupRankPairing(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  advanceCount: number,
): boolean {
  if (advanceCount !== 2 || groupOrder.length < 2) return false
  return groupOrder.every((gid) => (advancersByGroup.get(gid)?.length ?? 0) >= 2)
}

function buildAdvancersWithoutEntry(
  advancersByGroup: Map<string, StandingRow[]>,
  excludeEntryId: string | null,
): Map<string, StandingRow[]> {
  if (!excludeEntryId) return advancersByGroup
  const copy = new Map<string, StandingRow[]>()
  for (const [gid, rows] of advancersByGroup) {
    copy.set(
      gid,
      rows.filter((r) => r.entryId !== excludeEntryId),
    )
  }
  return copy
}

function buildEntryGroupMap(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const gid of groupOrder) {
    for (const row of advancersByGroup.get(gid) ?? []) {
      map.set(row.entryId, gid)
    }
  }
  return map
}

function assertNoSameGroupPairings(
  pairings: Pairing[],
  entryGroup: Map<string, string>,
): SeedingWarning[] {
  const warnings: SeedingWarning[] = []
  for (const p of pairings) {
    const gA = entryGroup.get(p.a.entryId)
    const gB = entryGroup.get(p.b.entryId)
    if (gA && gB && gA === gB) {
      warnings.push({
        message: `Same-group knockout pairing blocked: ${p.a.name} vs ${p.b.name}`,
      })
    }
  }
  return warnings
}

/**
 * First knockout round: group #1 vs another group's #2 (cross/block).
 * If total advancers is odd, the top group-stage seed gets a quarter bye.
 */
function buildFirstRoundGroupRankPairings(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  bracketType: KnockoutBracketType,
): { slots: KnockoutSlot[]; warnings: SeedingWarning[] } {
  const warnings: SeedingWarning[] = []
  const allAdvancers = collectAllAdvancers(advancersByGroup, groupOrder, 2)
  const ordered = [...allAdvancers].sort(compareStandingStrength)
  const firstBye = ordered.length % 2 === 1 ? ordered[0] : null
  const playingMap = buildAdvancersWithoutEntry(
    advancersByGroup,
    firstBye?.entryId ?? null,
  )

  let effectiveType = bracketType
  if (bracketType === 'block' && groupOrder.length % 2 !== 0) {
    warnings.push({
      message: `Block bracket needs an even number of groups (${groupOrder.length} groups) — using cross bracket instead`,
    })
    effectiveType = 'cross'
  }

  const pairings =
    effectiveType === 'block'
      ? pairBlockAdvanceTwo(playingMap, groupOrder)
      : pairCrossAdvanceTwo(playingMap, groupOrder)

  const entryGroup = buildEntryGroupMap(playingMap, groupOrder)
  warnings.push(...assertNoSameGroupPairings(pairings, entryGroup))

  const round = knockoutRoundFromBracketSize(
    nextPowerOf2(allAdvancers.length),
  )
  const slots: KnockoutSlot[] = []
  let slotNum = 0

  if (firstBye) {
    warnings.push({
      message: `Bye: ${firstBye.name} advances (top seed — odd advancer count)`,
    })
    slots.push({
      round,
      slot: slotNum++,
      bracketSide: 'left',
      entryAId: firstBye.entryId,
      entryBId: null,
      isBye: true,
      winnerEntryId: firstBye.entryId,
    })
  }

  for (const p of pairings) {
    slots.push({
      round,
      slot: slotNum++,
      bracketSide: p.side,
      entryAId: p.a.entryId,
      entryBId: p.b.entryId,
    })
  }

  return { slots, warnings }
}

/**
 * When advancer count is not a power of 2, fill the next power-of-2 bracket with byes
 * so the knockout always fits Quarters → Semis → Final (no extra waves).
 */
function buildStandardBracketWithByes(
  advancers: StandingRow[],
): { slots: KnockoutSlot[]; warnings: SeedingWarning[] } {
  const warnings: SeedingWarning[] = []
  const n = advancers.length
  const bracketSize = nextPowerOf2(n)
  const ordered = [...advancers].sort(compareStandingStrength)
  const seedOrder = getBracketSeedOrder(bracketSize)
  const matchCount = bracketSize / 2
  const slots: KnockoutSlot[] = []

  for (let i = 0; i < matchCount; i++) {
    const seedA = seedOrder[i * 2]
    const seedB = seedOrder[i * 2 + 1]
    const rowA = seedA <= n ? ordered[seedA - 1] : null
    const rowB = seedB <= n ? ordered[seedB - 1] : null
    const side = sideForSlot(i, matchCount)

    if (rowA && rowB) {
      slots.push({
        round: knockoutRoundFromBracketSize(bracketSize),
        slot: i,
        bracketSide: side,
        entryAId: rowA.entryId,
        entryBId: rowB.entryId,
      })
    } else if (rowA && !rowB) {
      warnings.push({
        message: `Bye: ${rowA.name} advances to ${knockoutRoundTitle(knockoutRoundFromBracketSize(bracketSize / 2)).toLowerCase()}`,
      })
      slots.push({
        round: knockoutRoundFromBracketSize(bracketSize),
        slot: i,
        bracketSide: side,
        entryAId: rowA.entryId,
        entryBId: null,
        isBye: true,
        winnerEntryId: rowA.entryId,
      })
    } else if (!rowA && rowB) {
      warnings.push({
        message: `Bye: ${rowB.name} advances to ${knockoutRoundTitle(knockoutRoundFromBracketSize(bracketSize / 2)).toLowerCase()}`,
      })
      slots.push({
        round: knockoutRoundFromBracketSize(bracketSize),
        slot: i,
        bracketSide: side,
        entryAId: rowB.entryId,
        entryBId: null,
        isBye: true,
        winnerEntryId: rowB.entryId,
      })
    }
  }

  const actualByeCount = slots.filter((s) => s.isBye).length
  if (actualByeCount > 0) {
    const skipRound = firstKnockoutRoundLabel(n)
    warnings.push({
      message: `${actualByeCount} bye${actualByeCount === 1 ? '' : 's'} after group stage — top seed${actualByeCount === 1 ? '' : 's'} skip ${skipRound}`,
    })
  }

  return { slots, warnings }
}

function findAdvancerRow(
  entryId: string,
  advancersByGroup: Map<string, StandingRow[]>,
): StandingRow | undefined {
  for (const rows of advancersByGroup.values()) {
    const row = rows.find((r) => r.entryId === entryId)
    if (row) return row
  }
  return undefined
}

function pickPlayInPlayer(
  rows: StandingRow[],
  playInIds: Set<string>,
  used: Set<string>,
  preferRank: number,
): StandingRow | undefined {
  const preferred = rows[preferRank]
  if (preferred && playInIds.has(preferred.entryId) && !used.has(preferred.entryId)) {
    return preferred
  }
  return rows.find((r) => playInIds.has(r.entryId) && !used.has(r.entryId))
}

/** Cross/block play-in pairings among non-bye advancers (avoids same-group QF rematches). */
function buildPlayInGroupRankPairings(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  playInIds: Set<string>,
  bracketType: KnockoutBracketType,
  matchCount: number,
): { pairings: Pairing[]; warnings: SeedingWarning[] } {
  const warnings: SeedingWarning[] = []
  const pairings: Pairing[] = []
  const used = new Set<string>()
  const entryGroup = buildEntryGroupMap(advancersByGroup, groupOrder)

  let effectiveType = bracketType
  if (bracketType === 'block' && groupOrder.length % 2 !== 0) {
    effectiveType = 'cross'
  }

  if (effectiveType === 'cross') {
    const g = groupOrder.length
    for (let i = 0; i < g && pairings.length < matchCount; i++) {
      const rowsA = advancersByGroup.get(groupOrder[i]) ?? []
      const rowsB = advancersByGroup.get(groupOrder[(i + 1) % g]) ?? []
      const a = pickPlayInPlayer(rowsA, playInIds, used, 0)
      const b = pickPlayInPlayer(rowsB, playInIds, used, 1)
      if (!a || !b) continue
      pairings.push({
        a,
        b,
        side: pairings.length % 2 === 0 ? 'left' : 'right',
        rankA: rowsA.indexOf(a),
        rankB: rowsB.indexOf(b),
      })
      used.add(a.entryId)
      used.add(b.entryId)
    }
  } else {
    for (let i = 0; i + 1 < groupOrder.length && pairings.length < matchCount; i += 2) {
      const rowsA = advancersByGroup.get(groupOrder[i]) ?? []
      const rowsB = advancersByGroup.get(groupOrder[i + 1]) ?? []
      const side = (i / 2) % 2 === 0 ? 'left' : 'right'

      const tryPair = (a: StandingRow | undefined, b: StandingRow | undefined) => {
        if (!a || !b || used.has(a.entryId) || used.has(b.entryId)) return
        if (!playInIds.has(a.entryId) || !playInIds.has(b.entryId)) return
        pairings.push({
          a,
          b,
          side,
          rankA: rowsA.indexOf(a) >= 0 ? rowsA.indexOf(a) : 0,
          rankB: rowsB.indexOf(b) >= 0 ? rowsB.indexOf(b) : 0,
        })
        used.add(a.entryId)
        used.add(b.entryId)
      }

      tryPair(pickPlayInPlayer(rowsA, playInIds, used, 0), pickPlayInPlayer(rowsB, playInIds, used, 1))
      if (pairings.length < matchCount) {
        tryPair(pickPlayInPlayer(rowsB, playInIds, used, 0), pickPlayInPlayer(rowsA, playInIds, used, 1))
      }
    }
  }

  const remaining = [...playInIds].filter((id) => !used.has(id))
  while (pairings.length < matchCount && remaining.length >= 2) {
    const aId = remaining.shift()!
    const diffGroupIdx = remaining.findIndex((id) => entryGroup.get(id) !== entryGroup.get(aId))
    const bId =
      diffGroupIdx >= 0 ? remaining.splice(diffGroupIdx, 1)[0]! : remaining.shift()!
    const a = findAdvancerRow(aId, advancersByGroup)
    const b = findAdvancerRow(bId, advancersByGroup)
    if (!a || !b) continue
    if (entryGroup.get(aId) === entryGroup.get(bId)) {
      warnings.push({
        message: `Play-in pairing could not avoid same group: ${a.name} vs ${b.name}`,
      })
    }
    pairings.push({
      a,
      b,
      side: pairings.length % 2 === 0 ? 'left' : 'right',
      rankA: 0,
      rankB: 0,
    })
    used.add(aId)
    used.add(bId)
  }

  return { pairings, warnings }
}

/**
 * Bye bracket with group-rank play-in: top seeds get byes; remaining advancers
 * play cross/block first round instead of pure strength seeding.
 */
function buildByeBracketWithGroupPairings(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  allAdvancers: StandingRow[],
  bracketType: KnockoutBracketType,
): { slots: KnockoutSlot[]; warnings: SeedingWarning[] } {
  const warnings: SeedingWarning[] = []
  const n = allAdvancers.length
  const bracketSize = nextPowerOf2(n)
  const ordered = [...allAdvancers].sort(compareStandingStrength)
  const byeCount = bracketSize - n
  const playInIds = new Set(ordered.slice(byeCount).map((r) => r.entryId))
  const playMatchCount = playInIds.size / 2

  const { pairings: playInPairings, warnings: playWarnings } = buildPlayInGroupRankPairings(
    advancersByGroup,
    groupOrder,
    playInIds,
    bracketType,
    playMatchCount,
  )
  warnings.push(...playWarnings)
  warnings.push(...assertUniqueTeams(playInPairings))

  if (playInPairings.length < playMatchCount) {
    warnings.push({
      message: `Only ${playInPairings.length} of ${playMatchCount} group-rank play-in matches could be built`,
    })
  }

  const coveredPlayIn = new Set(
    playInPairings.flatMap((p) => [p.a.entryId, p.b.entryId]),
  )
  for (const id of playInIds) {
    if (!coveredPlayIn.has(id)) {
      const row = findAdvancerRow(id, advancersByGroup)
      warnings.push({
        message: `Play-in advancer not placed in knockout: ${row?.name ?? id}`,
      })
    }
  }

  const { slots: stdSlots, warnings: stdWarnings } = buildStandardBracketWithByes(allAdvancers)
  warnings.push(...stdWarnings)

  let playIdx = 0
  const slots = stdSlots.map((slot) => {
    if (slot.isBye || playIdx >= playInPairings.length) return slot
    const p = playInPairings[playIdx++]!
    return {
      ...slot,
      entryAId: p.a.entryId,
      entryBId: p.b.entryId,
    }
  })

  const entryGroup = buildEntryGroupMap(advancersByGroup, groupOrder)
  warnings.push(...assertNoSameGroupPairings(playInPairings, entryGroup))

  return { slots, warnings }
}

function pairingWarnings(
  pairings: Pairing[],
  entries: Map<string, TournamentEntry>,
): SeedingWarning[] {
  const warnings: SeedingWarning[] = []
  for (const p of pairings) {
    const entryA = entries.get(p.a.entryId)
    const entryB = entries.get(p.b.entryId)
    if (!entryA || !entryB) continue

    const orgA = getEntryOrganization(entryA)
    const orgB = getEntryOrganization(entryB)
    if (orgA && orgB && orgA === orgB) {
      warnings.push({
        message: `Org siblings may meet early: ${p.a.name} vs ${p.b.name}`,
      })
    }

    if (isEntrySeeded(entryA) && isEntrySeeded(entryB)) {
      warnings.push({
        message: `Seeded vs seeded early: ${p.a.name} vs ${p.b.name}`,
      })
    }
  }
  return warnings
}

function assertUniqueTeams(pairings: Pairing[]): SeedingWarning[] {
  const seen = new Map<string, number>()
  for (const p of pairings) {
    seen.set(p.a.entryId, (seen.get(p.a.entryId) ?? 0) + 1)
    seen.set(p.b.entryId, (seen.get(p.b.entryId) ?? 0) + 1)
  }
  const warnings: SeedingWarning[] = []
  for (const [, count] of seen) {
    if (count > 1) {
      warnings.push({ message: `Team appears in ${count} first-round matches (should be 1)` })
    }
  }
  return warnings
}

/** Cross-group ring: group i #1 vs group i+1 #2 (each team once). */
function pairCrossAdvanceTwo(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
): Pairing[] {
  const pairings: Pairing[] = []
  const g = groupOrder.length

  for (let i = 0; i < g; i++) {
    const rowsA = advancersByGroup.get(groupOrder[i]) ?? []
    const rowsB = advancersByGroup.get(groupOrder[(i + 1) % g]) ?? []
    const first = rowsA[0]
    const second = rowsB[1]
    if (!first || !second) continue

    pairings.push({
      a: first,
      b: second,
      side: i % 2 === 0 ? 'left' : 'right',
      rankA: 0,
      rankB: 1,
    })
  }

  return pairings
}

function pairBlockAdvanceTwo(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
): Pairing[] {
  const pairings: Pairing[] = []

  for (let i = 0; i + 1 < groupOrder.length; i += 2) {
    const rowsA = advancersByGroup.get(groupOrder[i]) ?? []
    const rowsB = advancersByGroup.get(groupOrder[i + 1]) ?? []
    const side = (i / 2) % 2 === 0 ? 'left' : 'right'

    if (rowsA[0] && rowsB[1]) {
      pairings.push({ a: rowsA[0], b: rowsB[1], side, rankA: 0, rankB: 1 })
    }
    if (rowsB[0] && rowsA[1]) {
      pairings.push({ a: rowsB[0], b: rowsA[1], side, rankA: 0, rankB: 1 })
    }
  }

  return pairings
}

function pairBlockAdvanceOne(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
): Pairing[] {
  const pairings: Pairing[] = []

  for (let i = 0; i + 1 < groupOrder.length; i += 2) {
    const rowsA = advancersByGroup.get(groupOrder[i]) ?? []
    const rowsB = advancersByGroup.get(groupOrder[i + 1]) ?? []
    const a = rowsA[0]
    const b = rowsB[0]
    if (!a || !b) continue

    pairings.push({
      a,
      b,
      side: (i / 2) % 2 === 0 ? 'left' : 'right',
      rankA: 0,
      rankB: 0,
    })
  }

  return pairings
}

function pairBlockAdvanceMany(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  advanceCount: number,
): Pairing[] {
  const pairings: Pairing[] = []

  for (let i = 0; i + 1 < groupOrder.length; i += 2) {
    const blockGroups = [groupOrder[i], groupOrder[i + 1]]
    const blockMap = new Map<string, StandingRow[]>()
    blockGroups.forEach((gid) => blockMap.set(gid, advancersByGroup.get(gid) ?? []))
    const blockSide = (i / 2) % 2 === 0 ? 'left' : 'right'
    const inner = pairAdvanceMany(blockMap, blockGroups, advanceCount)
    inner.forEach((p) => pairings.push({ ...p, side: blockSide }))
  }

  return pairings
}

function pairAdvanceOne(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
): Pairing[] {
  const seeds = groupOrder
    .map((gid) => advancersByGroup.get(gid)?.[0])
    .filter((row): row is StandingRow => !!row)
  return pairByStrengthList(seeds)
}

function pairAdvanceMany(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  advanceCount: number,
): Pairing[] {
  const seeds: StandingRow[] = []
  for (let r = 0; r < advanceCount; r++) {
    for (const gid of groupOrder) {
      const row = advancersByGroup.get(gid)?.[r]
      if (row) seeds.push(row)
    }
  }
  return pairByStrengthList(seeds)
}

function pairByStrengthList(players: StandingRow[]): Pairing[] {
  const ordered = [...players].sort(compareStandingStrength)
  const pairings: Pairing[] = []
  const half = Math.floor(ordered.length / 2)
  for (let i = 0; i < half; i++) {
    pairings.push({
      a: ordered[i],
      b: ordered[ordered.length - 1 - i],
      side: i % 2 === 0 ? 'left' : 'right',
      rankA: 0,
      rankB: 0,
    })
  }
  return pairings
}

/** Pre-create semis + final placeholders (legacy helper for power-of-2 cross brackets). */
export function buildSemisAndFinal(firstRound: KnockoutSlot[]): KnockoutSlot[] {
  if (firstRound.some((s) => s.round === 'final')) return []

  const extra: KnockoutSlot[] = []
  const left = firstRound.filter((s) => s.bracketSide === 'left')
  const right = firstRound.filter((s) => s.bracketSide === 'right')

  if (left.length >= 2) {
    extra.push({ round: 'semi', slot: 0, bracketSide: 'left', entryAId: null, entryBId: null })
  }
  if (right.length >= 2) {
    extra.push({ round: 'semi', slot: 1, bracketSide: 'right', entryAId: null, entryBId: null })
  }
  if (firstRound.length >= 1) {
    extra.push({ round: 'final', slot: 0, bracketSide: 'left', entryAId: null, entryBId: null })
  }
  return extra
}

/**
 * Build the full knockout tree after group stage.
 * Round names follow bracket size (R16, QF, SF, F, …).
 */
export function buildCompleteKnockoutTree(firstRound: KnockoutSlot[]): KnockoutTreeNode[] {
  const firstBracketSize = firstRound.length * 2
  const nodes: KnockoutTreeNode[] = firstRound.map((slot, i) => ({
    key: `q-${i}`,
    slot: {
      ...slot,
      round: slot.round ?? knockoutRoundFromBracketSize(firstBracketSize),
      slot: i,
    },
  }))

  let roundKeys = nodes.map((n) => n.key)
  let nextSlot = 0

  while (roundKeys.length > 1) {
    if (roundKeys.length === 3) {
      const feederKeys = [...roundKeys]
      const playKey = `odd-play-${nextSlot}`
      const byeKey = `odd-bye-${nextSlot}`
      const round = knockoutRoundFromBracketSize(roundKeys.length)
      nextSlot++

      nodes.push({
        key: playKey,
        slot: {
          round,
          slot: nextSlot,
          bracketSide: 'right',
          entryAId: null,
          entryBId: null,
          pendingOddRound: true,
          isOddPlayIn: true,
          feederSourceKeys: feederKeys,
        },
      })
      nodes.push({
        key: byeKey,
        slot: {
          round,
          slot: nextSlot + 1,
          bracketSide: 'left',
          entryAId: null,
          entryBId: null,
          pendingOddRound: true,
          feederSourceKeys: feederKeys,
        },
      })
      roundKeys = [byeKey, playKey]
      nextSlot += 2
      continue
    }

    let pairingKeys = roundKeys
    let loneFeederKey: string | null = null
    if (roundKeys.length % 2 === 1) {
      loneFeederKey = roundKeys[roundKeys.length - 1]!
      pairingKeys = roundKeys.slice(0, -1)
    }

    const nextKeys: string[] = []
    const round = knockoutRoundFromBracketSize(roundKeys.length)
    const isFinal = round === 'final'

    for (let i = 0; i < pairingKeys.length; i += 2) {
      const key = isFinal ? 'f-0' : `s-${nextSlot}`
      if (!isFinal) nextSlot++

      nodes.push({
        key,
        slot: {
          round,
          slot: isFinal ? 0 : nextSlot - 1,
          bracketSide: sideForSlot(i, pairingKeys.length),
          entryAId: null,
          entryBId: null,
          sourceAKey: pairingKeys[i],
          sourceBKey: pairingKeys[i + 1],
        },
      })
      nextKeys.push(key)
    }

    if (loneFeederKey) {
      const passKey = `pass-${nextSlot}`
      if (!isFinal) nextSlot++
      nodes.push({
        key: passKey,
        slot: {
          round: isFinal ? 'final' : round,
          slot: isFinal ? 0 : nextSlot - 1,
          bracketSide: 'right',
          entryAId: null,
          entryBId: null,
          sourceAKey: loneFeederKey,
          sourceBKey: null,
        },
      })
      nextKeys.push(passKey)
    }

    roundKeys = nextKeys
  }

  return nodes
}

/**
 * Build knockout pairings after group stage.
 * Cross and block both use group-rank pairing when advancer count is a power of 2 (8, 16, …).
 * Otherwise both use seeded byes; when every group sends top 2, play-in uses group-rank pairing.
 */
export function generateKnockoutPairings(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  entries: Map<string, TournamentEntry>,
  advanceCount: number,
  bracketType: KnockoutBracketType = 'cross',
): { tree: KnockoutTreeNode[]; warnings: SeedingWarning[] } {
  const warnings: SeedingWarning[] = []

  if (groupOrder.length < 2 || advanceCount < 1) {
    return { tree: [], warnings: [{ message: 'Need at least 2 groups with advancers' }] }
  }

  for (const gid of groupOrder) {
    const rows = advancersByGroup.get(gid) ?? []
    if (rows.length < advanceCount) {
      warnings.push({
        message: `Group has only ${rows.length} advancer(s), expected ${advanceCount}`,
      })
    }
  }

  const allAdvancers = collectAllAdvancers(advancersByGroup, groupOrder, advanceCount)
  if (allAdvancers.length === 1) {
    return { tree: [], warnings: [{ message: 'Only one advancer — no knockout needed' }] }
  }

  if (allAdvancers.length === 2) {
    const ordered = [...allAdvancers].sort(compareStandingStrength)
    return {
      tree: [
        {
          key: 'f-0',
          slot: {
            round: 'final',
            slot: 0,
            bracketSide: 'left',
            entryAId: ordered[0].entryId,
            entryBId: ordered[1].entryId,
          },
        },
      ],
      warnings,
    }
  }

  let effectiveType = bracketType
  if (bracketType === 'block' && groupOrder.length % 2 !== 0) {
    warnings.push({
      message: `Block bracket needs an even number of groups (${groupOrder.length} groups) — using cross bracket instead`,
    })
    effectiveType = 'cross'
  }

  const useGroupRankPairing = supportsGroupRankPairing(advancersByGroup, groupOrder, advanceCount)
  const useByeBracket = !isPowerOf2(allAdvancers.length)
  let firstRound: KnockoutSlot[]

  if (useByeBracket) {
    const bracketLabel = bracketType === 'block' ? 'block' : 'cross'
    if (useGroupRankPairing) {
      warnings.push({
        message: `${allAdvancers.length} advancers — ${bracketLabel} knockout uses seeded byes with group-rank play-in`,
      })
      const { slots, warnings: byeWarnings } = buildByeBracketWithGroupPairings(
        advancersByGroup,
        groupOrder,
        allAdvancers,
        effectiveType,
      )
      warnings.push(...byeWarnings)
      firstRound = slots
    } else {
      warnings.push({
        message: `${allAdvancers.length} advancers — ${bracketLabel} knockout uses seeded bye bracket (top seeds skip ${firstKnockoutRoundLabel(allAdvancers.length)})`,
      })
      const { slots, warnings: byeWarnings } = buildStandardBracketWithByes(allAdvancers)
      warnings.push(...byeWarnings)
      firstRound = slots
    }

    const advancerById = new Map(allAdvancers.map((r) => [r.entryId, r]))
    const playPairings: Pairing[] = []
    for (const s of firstRound) {
      if (s.isBye || !s.entryAId || !s.entryBId) continue
      const a = advancerById.get(s.entryAId)
      const b = advancerById.get(s.entryBId)
      if (a && b) playPairings.push({ a, b, side: s.bracketSide, rankA: 0, rankB: 0 })
    }
    warnings.push(...pairingWarnings(playPairings, entries))
    if (!useGroupRankPairing) {
      warnings.push(
        ...assertNoSameGroupPairings(
          playPairings,
          buildEntryGroupMap(advancersByGroup, groupOrder),
        ),
      )
    }
  } else if (useGroupRankPairing) {
    const { slots, warnings: rankWarnings } = buildFirstRoundGroupRankPairings(
      advancersByGroup,
      groupOrder,
      effectiveType,
    )
    warnings.push(...rankWarnings)
    firstRound = slots
    const playPairings: Pairing[] = firstRound
      .filter((s) => s.entryAId && s.entryBId)
      .map((s) => {
        const a = allAdvancers.find((r) => r.entryId === s.entryAId)
        const b = allAdvancers.find((r) => r.entryId === s.entryBId)
        return a && b
          ? { a, b, side: s.bracketSide, rankA: 0, rankB: 1 }
          : null
      })
      .filter((p): p is Pairing => !!p)
    warnings.push(...assertUniqueTeams(playPairings))
    warnings.push(...pairingWarnings(playPairings, entries))
  } else {
    let pairings: Pairing[]
    if (effectiveType === 'block') {
      if (advanceCount === 2) {
        pairings = pairBlockAdvanceTwo(advancersByGroup, groupOrder)
      } else if (advanceCount === 1) {
        pairings = pairBlockAdvanceOne(advancersByGroup, groupOrder)
      } else {
        pairings = pairBlockAdvanceMany(advancersByGroup, groupOrder, advanceCount)
      }
    } else if (advanceCount === 2) {
      pairings = pairCrossAdvanceTwo(advancersByGroup, groupOrder)
    } else if (advanceCount === 1) {
      pairings = pairAdvanceOne(advancersByGroup, groupOrder)
    } else {
      pairings = pairAdvanceMany(advancersByGroup, groupOrder, advanceCount)
    }

    warnings.push(...assertUniqueTeams(pairings))
    warnings.push(...pairingWarnings(pairings, entries))
    warnings.push(...assertNoSameGroupPairings(pairings, buildEntryGroupMap(advancersByGroup, groupOrder)))

    const round = knockoutRoundFromBracketSize(
    nextPowerOf2(allAdvancers.length),
  )
    firstRound = pairings.map((p, idx) => ({
      round,
      slot: idx,
      bracketSide: p.side,
      entryAId: p.a.entryId,
      entryBId: p.b.entryId,
    }))
  }

  const tree = buildCompleteKnockoutTree(firstRound)

  return { tree, warnings }
}

/** @deprecated Use generateKnockoutPairings */
export function generateCrossGroupPairings(
  advancersByGroup: Map<string, StandingRow[]>,
  groupOrder: string[],
  entries: Map<string, TournamentEntry>,
  advanceCount: number,
): { tree: KnockoutTreeNode[]; warnings: SeedingWarning[] } {
  return generateKnockoutPairings(advancersByGroup, groupOrder, entries, advanceCount, 'cross')
}

export interface KnockoutMatchLike {
  id: string
  round: KnockoutRound | string
  slot: number
  bracket_side: 'left' | 'right'
  entry_a_id: string | null
  entry_b_id: string | null
  winner_entry_id: string | null
  source_match_a_id: string | null
  source_match_b_id: string | null
  status: string
  outcome?: string
  pending_odd_round?: boolean
  is_odd_play_in?: boolean
  feeder_source_match_ids?: string[]
}

function scheduledStatus(entryA: string | null, entryB: string | null): 'scheduled' | 'pending' {
  return entryA && entryB ? 'scheduled' : 'pending'
}

function winnerOf(m: KnockoutMatchLike | undefined): string | null {
  if (!m || m.status !== 'completed' || !m.winner_entry_id) return null
  return m.winner_entry_id
}

/** Fill later-round matches from source_match links after earlier rounds are scored. */
export function computeKnockoutAdvancement(
  matches: KnockoutMatchLike[],
  standingByEntryId?: Map<string, StandingRow>,
): Map<
  string,
  {
    entry_a_id: string | null
    entry_b_id: string | null
    winner_entry_id?: string | null
    status: 'scheduled' | 'pending' | 'completed'
    outcome?: string
    score_a?: number
    score_b?: number
  }
> {
  const updates = new Map<
    string,
    {
      entry_a_id: string | null
      entry_b_id: string | null
      winner_entry_id?: string | null
      status: 'scheduled' | 'pending' | 'completed'
      outcome?: string
      score_a?: number
      score_b?: number
    }
  >()

  if (!matches.length) return updates

  const byId = new Map(matches.map((m) => [m.id, m]))

  for (const m of matches) {
    if (!m.pending_odd_round || m.status === 'completed') continue
    const feederIds = m.feeder_source_match_ids ?? []
    if (!feederIds.length) continue

    const feeders = feederIds.map((id) => byId.get(id)).filter(Boolean) as KnockoutMatchLike[]
    if (feeders.length !== feederIds.length) continue
    if (!feeders.every((f) => f.status === 'completed' && f.winner_entry_id)) continue

    const winners = feeders
      .map((f) => {
        const id = f.winner_entry_id!
        return (
          standingByEntryId?.get(id) ?? {
            entryId: id,
            name: '',
            played: 0,
            wins: 0,
            losses: 0,
            scoreFor: 0,
            scoreAgainst: 0,
            diff: 0,
            rank: 0,
          }
        )
      })
      .sort(compareStandingStrength)

    if (winners.length < 3) continue

    if (m.is_odd_play_in) {
      updates.set(m.id, {
        entry_a_id: winners[1].entryId,
        entry_b_id: winners[2].entryId,
        status: 'scheduled',
      })
    } else {
      updates.set(m.id, {
        entry_a_id: winners[0].entryId,
        entry_b_id: null,
        winner_entry_id: winners[0].entryId,
        status: 'completed',
        outcome: 'bye',
        score_a: 1,
        score_b: 0,
      })
    }
  }

  const usesSources = matches.some((m) => m.source_match_a_id || m.source_match_b_id)

  if (usesSources) {
    for (const m of matches) {
      if (m.status === 'completed') continue
      if (!m.source_match_a_id && !m.source_match_b_id) continue

      const sourceA = m.source_match_a_id ? byId.get(m.source_match_a_id) : undefined
      const sourceB = m.source_match_b_id ? byId.get(m.source_match_b_id) : undefined

      if (m.source_match_a_id && !m.source_match_b_id) {
        const winner = winnerOf(sourceA)
        if (
          winner &&
          (m.entry_a_id !== winner ||
            m.winner_entry_id !== winner ||
            m.status !== 'completed')
        ) {
          updates.set(m.id, {
            entry_a_id: winner,
            entry_b_id: null,
            winner_entry_id: winner,
            status: 'completed',
            outcome: 'bye',
            score_a: 1,
            score_b: 0,
          })
        }
        continue
      }

      if (!m.source_match_a_id || !m.source_match_b_id) continue

      const entryA = winnerOf(sourceA) ?? m.entry_a_id
      const entryB = winnerOf(sourceB) ?? m.entry_b_id

      if (entryA !== m.entry_a_id || entryB !== m.entry_b_id) {
        updates.set(m.id, {
          entry_a_id: entryA,
          entry_b_id: entryB,
          status: scheduledStatus(entryA, entryB),
        })
      }
    }
    return updates
  }

  const effective = resolveEffectiveKnockoutRounds(matches)
  const usesExtendedRounds = matches.some(
    (m) => typeof m.round === 'string' && m.round.startsWith('r'),
  )
  if (usesExtendedRounds) return updates

  const roundsPresent = [
    ...new Set(
      matches.map((m) => effective.get(m.id) ?? m.round).filter(isKnockoutRound),
    ),
  ].sort(compareKnockoutRounds)

  const onlyFinal =
    roundsPresent.length === 1 && roundsPresent[0] === 'final'

  if (onlyFinal) return updates

  if (roundsPresent.length < 2) return updates

  const earlyRound = roundsPresent[0]!
  const nextRound = roundsPresent[1]!

  const early = matches
    .filter((m) => (effective.get(m.id) ?? m.round) === earlyRound)
    .sort((a, b) => a.slot - b.slot || a.bracket_side.localeCompare(b.bracket_side))
  const nextMatches = matches
    .filter(
      (m) =>
        (effective.get(m.id) ?? m.round) === nextRound &&
        !m.pending_odd_round &&
        !m.is_odd_play_in,
    )
    .sort((a, b) => a.slot - b.slot)
  const finalRound = roundsPresent[roundsPresent.length - 1]
  const final = matches.find((m) => (effective.get(m.id) ?? m.round) === finalRound)

  if (early.length !== nextMatches.length * 2) {
    return updates
  }

  for (let i = 0; i < nextMatches.length; i++) {
    const nextMatch = nextMatches[i]!
    const qfA = early[i * 2]
    const qfB = early[i * 2 + 1]
    if (!qfA) continue

    if (!qfB) {
      const entryA = winnerOf(qfA) ?? nextMatch.entry_a_id
      if (entryA && nextMatch.status !== 'completed') {
        updates.set(nextMatch.id, {
          entry_a_id: entryA,
          entry_b_id: null,
          winner_entry_id: entryA,
          status: 'completed',
          outcome: 'bye',
          score_a: 1,
          score_b: 0,
        })
      }
      continue
    }

    const entryA = winnerOf(qfA) ?? nextMatch.entry_a_id
    const entryB = winnerOf(qfB) ?? nextMatch.entry_b_id
    updates.set(nextMatch.id, {
      entry_a_id: entryA,
      entry_b_id: entryB,
      status: scheduledStatus(entryA, entryB),
    })
  }

  if (final && finalRound === 'final') {
    let entryA = final.entry_a_id
    let entryB = final.entry_b_id

    const semiRound = roundsPresent[roundsPresent.length - 2]
    const semis = matches
      .filter(
        (m) =>
          (effective.get(m.id) ?? m.round) === semiRound &&
          !m.pending_odd_round &&
          !m.is_odd_play_in,
      )
      .sort((a, b) => a.slot - b.slot)

    if (semis.length >= 2) {
      const semiA = semis[0]
      const semiB = semis[semis.length - 1]
      const wA = winnerOf(semiA)
      const wB = winnerOf(semiB)
      if (wA) entryA = wA
      if (wB) entryB = wB
    }

    updates.set(final.id, {
      entry_a_id: entryA,
      entry_b_id: entryB,
      status: scheduledStatus(entryA, entryB),
    })
  }

  return updates
}
