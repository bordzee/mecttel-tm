import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { deleteEventData, deleteTournamentData, deleteWhere, stripUndefined } from './firebaseHelpers'
import type {
  EventType,
  Category,
  Tournament,
  TournamentEvent,
  TournamentConfig,
  TournamentEntry,
  Group,
  GroupMatch,
  KnockoutMatch,
  Team,
  Player,
  Pair,
  StandingRow,
} from '../types'
import { assignEntriesToGroups } from './groupAssignment'
import { generateRoundRobinPairs } from './roundRobin'
import {
  generateKnockoutPairings,
  computeKnockoutAdvancement,
  type KnockoutTreeNode,
} from './knockoutSeeding'
import { computeStandings, getTopAdvancers, resolveGroupStandings } from './standings'
import { entrySortKey } from './groupLayout'

function withId<T>(id: string, data: T): T & { id: string } {
  return { id, ...data }
}

function eventsRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'events')
}

const knockoutGenerationInflight = new Map<
  string,
  Promise<{ generated: boolean; warnings: string[] }>
>()

async function syncTournamentPublicVisibility(tournamentId: string) {
  const events = await fetchEvents(tournamentId)
  const visible = events.some((e) => e.status === 'upcoming' || e.status === 'ongoing')
  await updateDoc(doc(db, 'tournaments', tournamentId), { public_visible: visible })
}

async function hydrateEntries(eventId: string): Promise<TournamentEntry[]> {
  const entriesSnap = await getDocs(
    query(collection(db, 'tournament_entries'), where('event_id', '==', eventId)),
  )

  const [teamsSnap, playersSnap, pairsSnap] = await Promise.all([
    getDocs(query(collection(db, 'teams'), where('event_id', '==', eventId))),
    getDocs(query(collection(db, 'players'), where('event_id', '==', eventId))),
    getDocs(query(collection(db, 'pairs'), where('event_id', '==', eventId))),
  ])

  const teams = new Map(teamsSnap.docs.map((d) => [d.id, withId(d.id, d.data() as Omit<Team, 'id'>)]))
  const players = new Map(
    playersSnap.docs.map((d) => [d.id, withId(d.id, d.data() as Omit<Player, 'id'>)]),
  )
  const pairs = new Map(pairsSnap.docs.map((d) => [d.id, withId(d.id, d.data() as Omit<Pair, 'id'>)]))

  const entries = entriesSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      team: data.team_id ? teams.get(data.team_id) ?? null : null,
      player: data.player_id ? players.get(data.player_id) ?? null : null,
      pair: data.pair_id ? pairs.get(data.pair_id) ?? null : null,
    } as TournamentEntry
  })

  return entries.sort((a, b) => entrySortKey(a) - entrySortKey(b))
}

export async function fetchEvents(tournamentId: string): Promise<TournamentEvent[]> {
  const snap = await getDocs(query(eventsRef(tournamentId), orderBy('sort_order', 'asc')))
  return snap.docs.map((d) =>
    withId(d.id, { tournament_id: tournamentId, ...d.data() } as Omit<TournamentEvent, 'id'>),
  )
}

export async function fetchPublicEvents(tournamentId: string): Promise<TournamentEvent[]> {
  const snap = await getDocs(
    query(eventsRef(tournamentId), where('status', 'in', ['upcoming', 'ongoing'])),
  )
  return snap.docs
    .map((d) =>
      withId(d.id, { tournament_id: tournamentId, ...d.data() } as Omit<TournamentEvent, 'id'>),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function fetchEvent(tournamentId: string, eventId: string): Promise<TournamentEvent> {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId, 'events', eventId))
  if (!snap.exists()) throw new Error('Event not found')
  return withId(snap.id, { tournament_id: tournamentId, ...snap.data() } as Omit<TournamentEvent, 'id'>)
}

export async function fetchPublicTournaments(): Promise<
  (Tournament & { events: TournamentEvent[] })[]
> {
  const snap = await getDocs(
    query(collection(db, 'tournaments'), where('public_visible', '==', true)),
  )
  const results: (Tournament & { events: TournamentEvent[] })[] = []

  for (const d of snap.docs) {
    const tournament = withId(d.id, d.data() as Omit<Tournament, 'id'>)
    const publicEvents = await fetchPublicEvents(tournament.id)
    if (publicEvents.length) {
      results.push({ ...tournament, events: publicEvents })
    }
  }

  return results.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
}

export async function fetchAllTournaments(): Promise<
  (Tournament & { events: TournamentEvent[] })[]
> {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('created_at', 'desc')))
  const results: (Tournament & { events: TournamentEvent[] })[] = []

  for (const d of snap.docs) {
    const tournament = withId(d.id, d.data() as Omit<Tournament, 'id'>)
    const events = await fetchEvents(tournament.id)
    results.push({ ...tournament, events })
  }

  return results
}

export async function fetchTournament(id: string) {
  const snap = await getDoc(doc(db, 'tournaments', id))
  if (!snap.exists()) throw new Error('Tournament not found')
  return withId(snap.id, snap.data() as Omit<Tournament, 'id'>)
}

export async function createTournament(input: {
  name: string
  venue: string
  start_date: string
}) {
  const ref = await addDoc(
    collection(db, 'tournaments'),
    stripUndefined({
      ...input,
      public_visible: false,
      created_at: new Date().toISOString(),
    }),
  )
  const snap = await getDoc(ref)
  return withId(snap.id, snap.data() as Omit<Tournament, 'id'>)
}

export async function createEvent(
  tournamentId: string,
  input: {
    name: string
    event_type: EventType
    category: Category | null
    config: TournamentConfig
    sort_order?: number
  },
) {
  const existing = await fetchEvents(tournamentId)
  const ref = await addDoc(
    eventsRef(tournamentId),
    stripUndefined({
      tournament_id: tournamentId,
      name: input.name,
      event_type: input.event_type,
      category: input.category,
      config: input.config,
      status: 'draft',
      sort_order: input.sort_order ?? existing.length,
      created_at: new Date().toISOString(),
    }),
  )
  const snap = await getDoc(ref)
  return withId(snap.id, snap.data() as Omit<TournamentEvent, 'id'>)
}

export async function createTournamentWithEvents(
  tournamentInput: { name: string; venue: string; start_date: string },
  events: {
    name: string
    event_type: EventType
    category: Category | null
    config: TournamentConfig
  }[],
) {
  const tournament = await createTournament(tournamentInput)
  const createdEvents: TournamentEvent[] = []
  for (let i = 0; i < events.length; i++) {
    const e = await createEvent(tournament.id, { ...events[i], sort_order: i })
    createdEvents.push(e)
  }
  return { tournament, events: createdEvents }
}

export async function updateTournament(id: string, patch: Partial<Tournament>) {
  await updateDoc(doc(db, 'tournaments', id), stripUndefined(patch))
  return fetchTournament(id)
}

export async function updateEvent(
  tournamentId: string,
  eventId: string,
  patch: Partial<TournamentEvent>,
) {
  if (patch.status === 'ended') {
    await deleteEventData(tournamentId, eventId)
    await syncTournamentPublicVisibility(tournamentId)
    return { id: eventId, tournament_id: tournamentId, ...patch } as TournamentEvent
  }
  await updateDoc(doc(db, 'tournaments', tournamentId, 'events', eventId), stripUndefined(patch))
  if (patch.status) await syncTournamentPublicVisibility(tournamentId)
  return fetchEvent(tournamentId, eventId)
}

export async function fetchEntries(eventId: string): Promise<TournamentEntry[]> {
  return hydrateEntries(eventId)
}

export async function deleteTournament(id: string) {
  await deleteTournamentData(id)
}

export async function deleteEvent(tournamentId: string, eventId: string) {
  await deleteEventData(tournamentId, eventId)
  await syncTournamentPublicVisibility(tournamentId)
}

async function entryScope(tournamentId: string, eventId: string) {
  return { tournament_id: tournamentId, event_id: eventId }
}

export async function addTeamEntry(
  tournamentId: string,
  eventId: string,
  team: { name: string; organization: string; seeded: boolean | null; roster: string[] },
) {
  const scope = await entryScope(tournamentId, eventId)
  const teamRef = await addDoc(collection(db, 'teams'), {
    ...scope,
    name: team.name,
    organization: team.organization || null,
    seeded: team.seeded,
  })

  if (team.roster.length) {
    const batch = writeBatch(db)
    team.roster.forEach((name) => {
      batch.set(doc(collection(db, 'team_players')), { team_id: teamRef.id, name })
    })
    await batch.commit()
  }

  await addDoc(collection(db, 'tournament_entries'), {
    ...scope,
    entry_type: 'team',
    team_id: teamRef.id,
    player_id: null,
    pair_id: null,
    seeded: team.seeded,
  })

  const snap = await getDoc(teamRef)
  return withId(snap.id, snap.data() as Omit<Team, 'id'>)
}

export async function addPlayerEntry(
  tournamentId: string,
  eventId: string,
  player: { name: string; organization: string; seeded: boolean | null },
) {
  const scope = await entryScope(tournamentId, eventId)
  const playerRef = await addDoc(collection(db, 'players'), {
    ...scope,
    name: player.name,
    organization: player.organization || null,
    seeded: player.seeded,
  })

  await addDoc(collection(db, 'tournament_entries'), {
    ...scope,
    entry_type: 'player',
    team_id: null,
    player_id: playerRef.id,
    pair_id: null,
    seeded: player.seeded,
  })

  const snap = await getDoc(playerRef)
  return withId(snap.id, snap.data() as Omit<Player, 'id'>)
}

export async function addPairEntry(
  tournamentId: string,
  eventId: string,
  pair: {
    pair_name: string
    player_a: string
    player_b: string
    organization: string
    seeded: boolean | null
  },
) {
  const scope = await entryScope(tournamentId, eventId)
  const pairRef = await addDoc(collection(db, 'pairs'), {
    ...scope,
    pair_name: pair.pair_name || null,
    player_a: pair.player_a,
    player_b: pair.player_b,
    organization: pair.organization || null,
    seeded: pair.seeded,
  })

  await addDoc(collection(db, 'tournament_entries'), {
    ...scope,
    entry_type: 'pair',
    team_id: null,
    player_id: null,
    pair_id: pairRef.id,
    seeded: pair.seeded,
  })

  const snap = await getDoc(pairRef)
  return withId(snap.id, snap.data() as Omit<Pair, 'id'>)
}

export async function fetchGroups(eventId: string) {
  const snap = await getDocs(query(collection(db, 'groups'), where('event_id', '==', eventId)))
  return snap.docs
    .map((d) => withId(d.id, d.data() as Omit<Group, 'id'>))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function saveGroupRankOrder(
  groupId: string,
  orderedEntryIds: string[],
  note?: string | null,
) {
  const trimmed = note?.trim()
  await updateDoc(doc(db, 'groups', groupId), {
    manual_rank_order: orderedEntryIds,
    manual_rank_note: trimmed || null,
  })
}

export async function clearGroupRankOrder(groupId: string) {
  await updateDoc(doc(db, 'groups', groupId), {
    manual_rank_order: null,
    manual_rank_note: null,
  })
}

export async function fetchGroupMembers(eventId: string, groupIds: string[]) {
  if (!groupIds.length) return []
  const entries = await fetchEntries(eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const results: { id: string; group_id: string; entry_id: string; entry?: TournamentEntry }[] = []

  for (const groupId of groupIds) {
    const snap = await getDocs(query(collection(db, 'group_members'), where('group_id', '==', groupId)))
    snap.docs.forEach((d) => {
      const data = d.data()
      results.push({
        id: d.id,
        group_id: data.group_id,
        entry_id: data.entry_id,
        entry: entryMap.get(data.entry_id),
      })
    })
  }
  return results
}

export async function setupGroupsAndMatches(
  tournamentId: string,
  event: TournamentEvent,
  entries: TournamentEntry[],
) {
  const groupCount = event.config.group_count!
  const { groups: assignments } = assignEntriesToGroups(
    entries,
    groupCount,
    event.config.group_sizes,
  )

  const existingGroups = await fetchGroups(event.id)
  for (const g of existingGroups) {
    await deleteWhere('group_members', 'group_id', g.id)
  }
  await deleteWhere('groups', 'event_id', event.id)
  await deleteWhere('group_matches', 'event_id', event.id)

  for (const assignment of assignments) {
    const groupRef = await addDoc(collection(db, 'groups'), {
      tournament_id: tournamentId,
      event_id: event.id,
      label: assignment.label,
    })

    const memberBatch = writeBatch(db)
    assignment.entryIds.forEach((entryId) => {
      memberBatch.set(doc(collection(db, 'group_members')), {
        group_id: groupRef.id,
        entry_id: entryId,
      })
    })
    await memberBatch.commit()

    const pairs = generateRoundRobinPairs(assignment.entryIds)
    const matchesBatch = writeBatch(db)
    pairs.forEach(([a, b]) => {
      matchesBatch.set(doc(collection(db, 'group_matches')), {
        tournament_id: tournamentId,
        event_id: event.id,
        group_id: groupRef.id,
        entry_a_id: a,
        entry_b_id: b,
        score_a: null,
        score_b: null,
        rubber_results: null,
        winner_entry_id: null,
        status: 'scheduled',
        outcome: 'normal',
      })
    })
    await matchesBatch.commit()
  }
}

export async function fetchGroupMatches(eventId: string) {
  const snap = await getDocs(
    query(collection(db, 'group_matches'), where('event_id', '==', eventId)),
  )
  const entries = await fetchEntries(eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      entry_a: entryMap.get(data.entry_a_id),
      entry_b: entryMap.get(data.entry_b_id),
    } as GroupMatch
  })
}

export async function fetchKnockoutMatches(eventId: string) {
  const snap = await getDocs(
    query(collection(db, 'knockout_matches'), where('event_id', '==', eventId)),
  )
  const entries = await fetchEntries(eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const roundOrder = { quarter: 0, semi: 1, final: 2 }
  return snap.docs
    .map((d) => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        entry_a: data.entry_a_id ? entryMap.get(data.entry_a_id) ?? null : null,
        entry_b: data.entry_b_id ? entryMap.get(data.entry_b_id) ?? null : null,
      } as KnockoutMatch
    })
    .sort((a, b) => {
      const rd = roundOrder[a.round] - roundOrder[b.round]
      return rd !== 0 ? rd : a.slot - b.slot
    })
}

export async function saveGroupMatchResult(
  matchId: string,
  update: {
    score_a: number
    score_b: number
    rubber_results?: { home: ('W' | 'L' | null)[] } | null
    winner_entry_id: string
    outcome: string
  },
) {
  const matchRef = doc(db, 'group_matches', matchId)
  const matchSnap = await getDoc(matchRef)
  if (!matchSnap.exists()) throw new Error('Match not found')

  await updateDoc(matchRef, { ...update, status: 'completed' })
  return { generated: false, warnings: [] as string[] }
}

export async function maybeAutoGenerateKnockout(
  tournamentId: string,
  eventId: string,
): Promise<{ generated: boolean; warnings: string[] }> {
  const inflight = knockoutGenerationInflight.get(eventId)
  if (inflight) return inflight

  const promise = (async (): Promise<{ generated: boolean; warnings: string[] }> => {
    const existing = await fetchKnockoutMatches(eventId)
    if (existing.length > 0) return { generated: false, warnings: [] }

    const groupMatches = await fetchGroupMatches(eventId)
    if (!groupMatches.length) return { generated: false, warnings: [] }

    const allComplete = groupMatches.every((m) => m.status === 'completed')
    if (!allComplete) return { generated: false, warnings: [] }

    const event = await fetchEvent(tournamentId, eventId)
    const warnings = await generateKnockoutBracket(tournamentId, event)
    return { generated: true, warnings: warnings.map((w) => w.message) }
  })()

  knockoutGenerationInflight.set(eventId, promise)
  try {
    return await promise
  } finally {
    knockoutGenerationInflight.delete(eventId)
  }
}

export async function propagateKnockoutWinners(eventId: string) {
  const matches = await fetchKnockoutMatches(eventId)
  if (!matches.length) return

  const tournamentId = matches[0].tournament_id
  const standingMap = await fetchAdvancerStandingMap(tournamentId, eventId)
  const updates = computeKnockoutAdvancement(matches, standingMap)

  const batch = writeBatch(db)
  let hasWrites = false

  for (const m of matches) {
    if (m.status === 'completed' && !updates.has(m.id)) continue
    const patch = updates.get(m.id)
    if (!patch) continue

    const changed =
      patch.entry_a_id !== m.entry_a_id ||
      patch.entry_b_id !== m.entry_b_id ||
      patch.status !== m.status ||
      (patch.winner_entry_id != null && patch.winner_entry_id !== m.winner_entry_id) ||
      (patch.outcome != null && patch.outcome !== m.outcome)

    if (changed) {
      batch.update(doc(db, 'knockout_matches', m.id), patch)
      hasWrites = true
    }
  }

  if (hasWrites) await batch.commit()
}

async function fetchAdvancerStandingMap(
  tournamentId: string,
  eventId: string,
): Promise<Map<string, StandingRow>> {
  const event = await fetchEvent(tournamentId, eventId)
  const groups = await fetchGroups(eventId)
  const members = await fetchGroupMembers(eventId, groups.map((g) => g.id))
  const matches = await fetchGroupMatches(eventId)
  const entries = await fetchEntries(eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))

  const standingsByGroup = new Map<string, StandingRow[]>()
  for (const group of groups) {
    const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
    const groupMatches = matches.filter((m) => m.group_id === group.id)
    standingsByGroup.set(
      group.id,
      resolveGroupStandings(entryIds, groupMatches, entryMap, group.manual_rank_order),
    )
  }

  const advancers = getTopAdvancers(standingsByGroup, event.config.advance_count)
  const map = new Map<string, StandingRow>()
  for (const rows of advancers.values()) {
    for (const row of rows) {
      map.set(row.entryId, row)
    }
  }
  return map
}

function writeKnockoutTree(
  batch: ReturnType<typeof writeBatch>,
  tournamentId: string,
  eventId: string,
  tree: KnockoutTreeNode[],
) {
  const keyToId = new Map<string, string>()
  for (const node of tree) {
    keyToId.set(node.key, doc(collection(db, 'knockout_matches')).id)
  }

  for (const node of tree) {
    const isBye = node.slot.isBye === true
    const matchId = keyToId.get(node.key)!
    batch.set(doc(db, 'knockout_matches', matchId), {
      tournament_id: tournamentId,
      event_id: eventId,
      round: node.slot.round,
      slot: node.slot.slot,
      bracket_side: node.slot.bracketSide,
      entry_a_id: node.slot.entryAId,
      entry_b_id: node.slot.entryBId,
      score_a: isBye ? 1 : null,
      score_b: isBye ? 0 : null,
      rubber_results: null,
      winner_entry_id: isBye ? (node.slot.winnerEntryId ?? node.slot.entryAId) : null,
      source_match_a_id: node.slot.sourceAKey
        ? (keyToId.get(node.slot.sourceAKey) ?? null)
        : null,
      source_match_b_id: node.slot.sourceBKey
        ? (keyToId.get(node.slot.sourceBKey) ?? null)
        : null,
      pending_odd_round: node.slot.pendingOddRound ?? false,
      is_odd_play_in: node.slot.isOddPlayIn ?? false,
      feeder_source_match_ids: (node.slot.feederSourceKeys ?? [])
        .map((key) => keyToId.get(key))
        .filter((id): id is string => !!id),
      status: isBye ? 'completed' : node.slot.entryAId && node.slot.entryBId ? 'scheduled' : 'pending',
      outcome: isBye ? 'bye' : 'normal',
    })
  }
}

export async function saveKnockoutMatchResult(
  matchId: string,
  update: {
    score_a: number
    score_b: number
    rubber_results?: { home: ('W' | 'L' | null)[] } | null
    winner_entry_id: string
    outcome: string
  },
) {
  const matchRef = doc(db, 'knockout_matches', matchId)
  const matchSnap = await getDoc(matchRef)
  if (!matchSnap.exists()) throw new Error('Match not found')

  await updateDoc(matchRef, { ...update, status: 'completed' })

  const eventId = matchSnap.data().event_id as string
  await propagateKnockoutWinners(eventId)
}

export async function generateKnockoutBracket(tournamentId: string, event: TournamentEvent) {
  const groups = await fetchGroups(event.id)
  const members = await fetchGroupMembers(event.id, groups.map((g) => g.id))
  const matches = await fetchGroupMatches(event.id)
  const entries = await fetchEntries(event.id)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const advanceCount = event.config.advance_count
  const groupOrder = groups.map((g) => g.id)

  const standingsByGroup = new Map<string, ReturnType<typeof computeStandings>>()
  const preWarnings: string[] = []

  for (const group of groups) {
    const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
    const groupMatches = matches.filter((m) => m.group_id === group.id)
    standingsByGroup.set(
      group.id,
      resolveGroupStandings(entryIds, groupMatches, entryMap, group.manual_rank_order),
    )

    const unplayed = groupMatches.filter((m) => m.status !== 'completed').length
    if (unplayed > 0) {
      preWarnings.push(
        `Group ${group.label} still has ${unplayed} unplayed match${unplayed === 1 ? '' : 'es'}`,
      )
    }
  }

  const advancers = getTopAdvancers(standingsByGroup, advanceCount)
  const bracketType = event.config.knockout_bracket ?? 'cross'

  const { tree, warnings } = generateKnockoutPairings(
    advancers,
    groupOrder,
    entryMap,
    advanceCount,
    bracketType,
  )

  const existing = await getDocs(
    query(collection(db, 'knockout_matches'), where('event_id', '==', event.id)),
  )
  const delBatch = writeBatch(db)
  existing.docs.forEach((d) => delBatch.delete(d.ref))
  await delBatch.commit()

  if (tree.length) {
    const addBatch = writeBatch(db)
    writeKnockoutTree(addBatch, tournamentId, event.id, tree)
    await addBatch.commit()
    await propagateKnockoutWinners(event.id)
  }

  return [
    ...preWarnings.map((message) => ({ message })),
    ...warnings,
  ]
}

export async function regenerateKnockoutFromRanks(tournamentId: string, eventId: string) {
  const existing = await fetchKnockoutMatches(eventId)
  if (existing.some((m) => m.status === 'completed')) {
    throw new Error('Cannot update knockout — some knockout matches are already scored')
  }
  const event = await fetchEvent(tournamentId, eventId)
  return generateKnockoutBracket(tournamentId, event)
}

export async function fetchTeamRosters(teamIds: string[]) {
  if (!teamIds.length) return []
  const results: { id: string; team_id: string; name: string }[] = []
  for (const teamId of teamIds) {
    const snap = await getDocs(query(collection(db, 'team_players'), where('team_id', '==', teamId)))
    snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as { id: string; team_id: string; name: string }))
  }
  return results
}

export async function deleteEntry(entry: TournamentEntry) {
  if (entry.team_id) {
    const roster = await getDocs(
      query(collection(db, 'team_players'), where('team_id', '==', entry.team_id)),
    )
    const batch = writeBatch(db)
    roster.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(doc(db, 'teams', entry.team_id))
    batch.delete(doc(db, 'tournament_entries', entry.id))
    await batch.commit()
    return
  }
  const batch = writeBatch(db)
  batch.delete(doc(db, 'tournament_entries', entry.id))
  if (entry.player_id) batch.delete(doc(db, 'players', entry.player_id))
  if (entry.pair_id) batch.delete(doc(db, 'pairs', entry.pair_id))
  await batch.commit()
}
