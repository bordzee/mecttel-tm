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
import { deleteEventData, deleteTournamentData, deleteWhere, deleteEventScopeWhere, deleteQueryDocs, deleteEntryReferences, stripUndefined } from './firebaseHelpers'
import { deleteTournamentImageFiles } from './tournamentImageService'
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
import { sortKnockoutMatches } from './knockoutRounds'
import { generateRoundRobinPairs } from './roundRobin'
import { newRoundRobinPairsForEntry, nextGroupLabel, validateLateJoinTarget, type LateJoinMode } from './lateJoinAssignment'
import {
  generateKnockoutPairings,
  computeKnockoutAdvancement,
  type KnockoutTreeNode,
} from './knockoutSeeding'
import { computeStandings, getTopAdvancers, resolveGroupStandings, needsManualRankResolution } from './standings'
import { validateMatchResultSave } from './matchValidation'
import { validateSetRulesAgainstCompletedMatches } from './setRulesValidation'
import { normalizeSetRules } from './setRules'
import type { SetRules } from '../types'
import { entrySortKey } from './groupLayout'

function withId<T>(id: string, data: T): T & { id: string } {
  return { id, ...data }
}

function eventsRef(tournamentId: string) {
  return collection(db, 'tournaments', tournamentId, 'events')
}

/** Queries scoped by tournament + event so Firestore rules can authorize public reads. */
function eventScopeQuery(collectionName: string, tournamentId: string, eventId: string) {
  return query(
    collection(db, collectionName),
    where('tournament_id', '==', tournamentId),
    where('event_id', '==', eventId),
  )
}

const knockoutPropagationInflight = new Map<string, Promise<void>>()

const BATCH_SIZE = 450

type PendingWrite = { ref: ReturnType<typeof doc>; data: Record<string, unknown> }

async function commitBatchSets(pendingSets: PendingWrite[]) {
  for (let i = 0; i < pendingSets.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    pendingSets.slice(i, i + BATCH_SIZE).forEach(({ ref, data }) => batch.set(ref, data))
    await batch.commit()
  }
}

async function syncTournamentPublicVisibility(tournamentId: string) {
  const [events, tournament] = await Promise.all([
    fetchEvents(tournamentId),
    fetchTournament(tournamentId),
  ])
  const visible = events.some((e) => e.status === 'upcoming' || e.status === 'ongoing')
  await updateDoc(
    doc(db, 'tournaments', tournamentId),
    stripUndefined({
      name: tournament.name,
      venue: tournament.venue ?? '',
      start_date: tournament.start_date ?? '',
      image_url: tournament.image_url ?? null,
      public_visible: visible,
    }),
  )
}

async function hydrateEntries(tournamentId: string, eventId: string): Promise<TournamentEntry[]> {
  const entriesSnap = await getDocs(eventScopeQuery('tournament_entries', tournamentId, eventId))

  const [teamsSnap, playersSnap, pairsSnap] = await Promise.all([
    getDocs(eventScopeQuery('teams', tournamentId, eventId)),
    getDocs(eventScopeQuery('players', tournamentId, eventId)),
    getDocs(eventScopeQuery('pairs', tournamentId, eventId)),
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
      name: input.name,
      venue: input.venue || null,
      start_date: input.start_date || null,
      image_url: null,
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
    status?: TournamentEvent['status']
  },
) {
  const existing = await fetchEvents(tournamentId)
  const status = input.status ?? 'draft'
  const ref = await addDoc(
    eventsRef(tournamentId),
    stripUndefined({
      tournament_id: tournamentId,
      name: input.name,
      event_type: input.event_type,
      category: input.category,
      config: input.config,
      status,
      sort_order: Math.trunc(input.sort_order ?? existing.length),
      created_at: new Date().toISOString(),
    }),
  )
  if (status === 'upcoming' || status === 'ongoing') {
    await syncTournamentPublicVisibility(tournamentId)
  }
  const snap = await getDoc(ref)
  return withId(snap.id, { tournament_id: tournamentId, ...snap.data() } as Omit<TournamentEvent, 'id'>)
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

export async function updateEventSetRules(
  tournamentId: string,
  eventId: string,
  setRules: SetRules,
) {
  const event = await fetchEvent(tournamentId, eventId)
  if (event.status !== 'ongoing') {
    throw new Error('Set rules can only be changed while the division is live')
  }

  const normalized = normalizeSetRules(setRules)
  const [groupMatches, knockoutMatches] = await Promise.all([
    fetchGroupMatches(tournamentId, eventId),
    fetchKnockoutMatches(tournamentId, eventId),
  ])

  const validationError = validateSetRulesAgainstCompletedMatches(
    event.event_type,
    normalized,
    groupMatches,
    knockoutMatches,
  )
  if (validationError) {
    throw new Error(validationError)
  }

  await updateEvent(tournamentId, eventId, {
    config: {
      ...event.config,
      set_rules: normalized,
    },
  })
}

export async function fetchEntries(tournamentId: string, eventId: string): Promise<TournamentEntry[]> {
  return hydrateEntries(tournamentId, eventId)
}

export async function deleteTournament(id: string) {
  await deleteTournamentData(id)
  await deleteTournamentImageFiles(id)
}

export async function deleteEvent(tournamentId: string, eventId: string) {
  await deleteEventData(tournamentId, eventId)
  await syncTournamentPublicVisibility(tournamentId)
}

function entryScope(tournamentId: string, eventId: string) {
  return { tournament_id: tournamentId, event_id: eventId }
}

export async function addTeamEntry(
  tournamentId: string,
  eventId: string,
  team: { name: string; organization: string; seeded: boolean | null; roster: string[] },
) {
  const scope = entryScope(tournamentId, eventId)
  const teamRef = doc(collection(db, 'teams'))
  const entryRef = doc(collection(db, 'tournament_entries'))
  const batch = writeBatch(db)

  batch.set(teamRef, {
    ...scope,
    name: team.name,
    organization: team.organization || null,
    seeded: team.seeded,
  })

  team.roster.forEach((name) => {
    batch.set(doc(collection(db, 'team_players')), { team_id: teamRef.id, name })
  })

  batch.set(entryRef, {
    ...scope,
    entry_type: 'team',
    team_id: teamRef.id,
    player_id: null,
    pair_id: null,
    seeded: team.seeded,
  })

  await batch.commit()
  const snap = await getDoc(teamRef)
  return { team: withId(snap.id, snap.data() as Omit<Team, 'id'>), entryId: entryRef.id }
}

export async function addPlayerEntry(
  tournamentId: string,
  eventId: string,
  player: { name: string; organization: string; seeded: boolean | null },
) {
  const scope = entryScope(tournamentId, eventId)
  const playerRef = doc(collection(db, 'players'))
  const entryRef = doc(collection(db, 'tournament_entries'))
  const batch = writeBatch(db)

  batch.set(playerRef, {
    ...scope,
    name: player.name,
    organization: player.organization || null,
    seeded: player.seeded,
  })

  batch.set(entryRef, {
    ...scope,
    entry_type: 'player',
    team_id: null,
    player_id: playerRef.id,
    pair_id: null,
    seeded: player.seeded,
  })

  await batch.commit()
  const snap = await getDoc(playerRef)
  return { player: withId(snap.id, snap.data() as Omit<Player, 'id'>), entryId: entryRef.id }
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
  const scope = entryScope(tournamentId, eventId)
  const pairRef = doc(collection(db, 'pairs'))
  const entryRef = doc(collection(db, 'tournament_entries'))
  const batch = writeBatch(db)

  batch.set(pairRef, {
    ...scope,
    pair_name: pair.pair_name || null,
    player_a: pair.player_a,
    player_b: pair.player_b,
    organization: pair.organization || null,
    seeded: pair.seeded,
  })

  batch.set(entryRef, {
    ...scope,
    entry_type: 'pair',
    team_id: null,
    player_id: null,
    pair_id: pairRef.id,
    seeded: pair.seeded,
  })

  await batch.commit()
  const snap = await getDoc(pairRef)
  return { pair: withId(snap.id, snap.data() as Omit<Pair, 'id'>), entryId: entryRef.id }
}

export async function updatePlayerEntry(
  entry: TournamentEntry,
  update: { name: string; organization: string | null; seeded: boolean | null },
) {
  if (!entry.player_id) throw new Error('Not a player entry')
  const batch = writeBatch(db)
  batch.update(doc(db, 'players', entry.player_id), {
    name: update.name,
    organization: update.organization || null,
    seeded: update.seeded,
  })
  batch.update(doc(db, 'tournament_entries', entry.id), { seeded: update.seeded })
  await batch.commit()
}

export async function updatePairEntry(
  entry: TournamentEntry,
  update: {
    pair_name: string
    player_a: string
    player_b: string
    organization: string | null
    seeded: boolean | null
  },
) {
  if (!entry.pair_id) throw new Error('Not a pair entry')
  const batch = writeBatch(db)
  batch.update(doc(db, 'pairs', entry.pair_id), {
    pair_name: update.pair_name || null,
    player_a: update.player_a,
    player_b: update.player_b,
    organization: update.organization || null,
    seeded: update.seeded,
  })
  batch.update(doc(db, 'tournament_entries', entry.id), { seeded: update.seeded })
  await batch.commit()
}

export async function updateTeamEntry(
  entry: TournamentEntry,
  update: {
    name: string
    organization: string | null
    seeded: boolean | null
    roster?: string[]
  },
) {
  if (!entry.team_id) throw new Error('Not a team entry')
  const batch = writeBatch(db)
  batch.update(doc(db, 'teams', entry.team_id), {
    name: update.name,
    organization: update.organization || null,
    seeded: update.seeded,
  })
  batch.update(doc(db, 'tournament_entries', entry.id), { seeded: update.seeded })

  if (update.roster) {
    const rosterSnap = await getDocs(
      query(collection(db, 'team_players'), where('team_id', '==', entry.team_id)),
    )
    rosterSnap.docs.forEach((d) => batch.delete(d.ref))
    update.roster.forEach((name) => {
      batch.set(doc(collection(db, 'team_players')), { team_id: entry.team_id, name })
    })
  }

  await batch.commit()
}

export async function fetchGroups(tournamentId: string, eventId: string) {
  const snap = await getDocs(eventScopeQuery('groups', tournamentId, eventId))
  return snap.docs
    .map((d) => withId(d.id, d.data() as Omit<Group, 'id'>))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function saveGroupRankOrder(
  groupId: string,
  orderedEntryIds: string[],
  note?: string | null,
  options?: { allowWhenKnockoutScored?: boolean; tournamentId?: string; eventId?: string },
) {
  if (!options?.allowWhenKnockoutScored && options?.eventId && options?.tournamentId) {
    const knockout = await fetchKnockoutMatches(options.tournamentId, options.eventId)
    if (knockout.some((m) => m.status === 'completed')) {
      throw new Error('Cannot change group ranks — knockout matches are already scored')
    }
  }

  const membersSnap = await getDocs(
    query(collection(db, 'group_members'), where('group_id', '==', groupId)),
  )
  const memberIds = new Set(membersSnap.docs.map((d) => d.data().entry_id as string))
  const uniqueOrder = [...new Set(orderedEntryIds)]
  if (
    uniqueOrder.length !== memberIds.size ||
    !uniqueOrder.every((id) => memberIds.has(id))
  ) {
    throw new Error('Rank order must include every group member exactly once')
  }

  const trimmed = note?.trim()
  await updateDoc(doc(db, 'groups', groupId), {
    manual_rank_order: orderedEntryIds,
    manual_rank_note: trimmed || null,
  })
}

export async function clearGroupRankOrder(
  groupId: string,
  options?: { allowWhenKnockoutScored?: boolean; tournamentId?: string; eventId?: string },
) {
  if (!options?.allowWhenKnockoutScored && options?.eventId && options?.tournamentId) {
    const knockout = await fetchKnockoutMatches(options.tournamentId, options.eventId)
    if (knockout.some((m) => m.status === 'completed')) {
      throw new Error('Cannot reset group ranks — knockout matches are already scored')
    }
  }
  await updateDoc(doc(db, 'groups', groupId), {
    manual_rank_order: null,
    manual_rank_note: null,
  })
}

export async function fetchGroupMembers(
  tournamentId: string,
  eventId: string,
  groupIds: string[],
) {
  if (!groupIds.length) return []
  const entries = await fetchEntries(tournamentId, eventId)
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
  const assignment = assignEntriesToGroups(
    entries,
    groupCount,
    event.config.group_sizes,
  )
  if (assignment.error) {
    throw new Error(assignment.error)
  }
  const { groups: assignments } = assignment

  type PendingWriteLocal = { ref: ReturnType<typeof doc>; data: Record<string, unknown> }
  const groupWrites: PendingWriteLocal[] = []
  const memberAndMatchWrites: PendingWriteLocal[] = []

  for (const assignment of assignments) {
    const groupRef = doc(collection(db, 'groups'))
    groupWrites.push({
      ref: groupRef,
      data: {
        tournament_id: tournamentId,
        event_id: event.id,
        label: assignment.label,
      },
    })

    assignment.entryIds.forEach((entryId) => {
      memberAndMatchWrites.push({
        ref: doc(collection(db, 'group_members')),
        data: { group_id: groupRef.id, entry_id: entryId },
      })
    })

    const pairs = generateRoundRobinPairs(assignment.entryIds)
    pairs.forEach(([a, b]) => {
      memberAndMatchWrites.push({
        ref: doc(collection(db, 'group_matches')),
        data: {
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
        },
      })
    })
  }

  const existingGroups = await fetchGroups(tournamentId, event.id)
  for (const g of existingGroups) {
    await deleteWhere('group_members', { field: 'group_id', value: g.id })
  }
  await deleteEventScopeWhere('groups', tournamentId, event.id)
  await deleteEventScopeWhere('group_matches', tournamentId, event.id)
  await deleteEventScopeWhere('knockout_matches', tournamentId, event.id)

  // Groups must commit before members — Firestore rules check group_id exists.
  await commitBatchSets(groupWrites)
  await commitBatchSets(memberAndMatchWrites)
}

export async function fetchGroupMatches(tournamentId: string, eventId: string) {
  const snap = await getDocs(eventScopeQuery('group_matches', tournamentId, eventId))
  const entries = await fetchEntries(tournamentId, eventId)
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

export async function fetchKnockoutMatches(tournamentId: string, eventId: string) {
  const snap = await getDocs(eventScopeQuery('knockout_matches', tournamentId, eventId))
  const entries = await fetchEntries(tournamentId, eventId)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  return sortKnockoutMatches(
    snap.docs
      .map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          entry_a: data.entry_a_id ? entryMap.get(data.entry_a_id) ?? null : null,
          entry_b: data.entry_b_id ? entryMap.get(data.entry_b_id) ?? null : null,
        } as KnockoutMatch
      }),
  )
}

export async function generateGroupStage(
  tournamentId: string,
  event: TournamentEvent,
  entries: TournamentEntry[],
  updatedConfig: TournamentConfig,
) {
  const fresh = await fetchEvent(tournamentId, event.id)
  if (fresh.status !== 'upcoming') {
    throw new Error('Group stage can only be generated while registration is open')
  }

  const eventForSetup = { ...fresh, config: updatedConfig }
  await setupGroupsAndMatches(tournamentId, eventForSetup, entries)
  return updateEvent(tournamentId, event.id, { config: updatedConfig, status: 'ongoing' })
}

/** @deprecated Use generateGroupStage */
export const startDivision = generateGroupStage

export type LateJoinAssignment =
  | { mode: Extract<LateJoinMode, 'balance' | 'pick'>; groupId: string }
  | { mode: 'new_group' }

export type LateJoinEntryInput =
  | { type: 'team'; name: string; organization: string; seeded: boolean | null; roster: string[] }
  | { type: 'player'; name: string; organization: string; seeded: boolean | null }
  | {
      type: 'pair'
      pair_name: string
      player_a: string
      player_b: string
      organization: string
      seeded: boolean | null
    }

export function mockEntryFromLateJoinInput(
  tournamentId: string,
  eventId: string,
  input: LateJoinEntryInput,
): TournamentEntry {
  const base = {
    id: '__pending__',
    tournament_id: tournamentId,
    event_id: eventId,
    team_id: null as string | null,
    player_id: null as string | null,
    pair_id: null as string | null,
    seeded: input.seeded,
  }
  if (input.type === 'team') {
    return {
      ...base,
      entry_type: 'team',
      team: {
        id: 'pending',
        tournament_id: tournamentId,
        event_id: eventId,
        name: input.name,
        organization: input.organization || null,
        seeded: input.seeded,
      },
    }
  }
  if (input.type === 'player') {
    return {
      ...base,
      entry_type: 'player',
      player: {
        id: 'pending',
        tournament_id: tournamentId,
        event_id: eventId,
        name: input.name,
        organization: input.organization || null,
        seeded: input.seeded,
      },
    }
  }
  return {
    ...base,
    entry_type: 'pair',
    pair: {
      id: 'pending',
      tournament_id: tournamentId,
      event_id: eventId,
      pair_name: input.pair_name || null,
      player_a: input.player_a,
      player_b: input.player_b,
      organization: input.organization || null,
      seeded: input.seeded,
    },
  }
}

export async function addLateJoinEntry(
  tournamentId: string,
  eventId: string,
  input: LateJoinEntryInput,
  assignment: LateJoinAssignment,
): Promise<{ entryId: string; warnings: string[] }> {
  const [event, knockout, groups, entries] = await Promise.all([
    fetchEvent(tournamentId, eventId),
    fetchKnockoutMatches(tournamentId, eventId),
    fetchGroups(tournamentId, eventId),
    fetchEntries(tournamentId, eventId),
  ])

  if (event.status !== 'ongoing') {
    throw new Error('Late check-in is only available during the group stage')
  }
  if (knockout.length > 0) {
    throw new Error('Cannot add late entries after the knockout bracket has been generated')
  }
  if (!groups.length) {
    throw new Error('Group stage has not been generated yet')
  }

  const mockEntry = mockEntryFromLateJoinInput(tournamentId, eventId, input)
  const members = await fetchGroupMembers(
    tournamentId,
    eventId,
    groups.map((g) => g.id),
  )

  const warnings: string[] = []
  const scope = entryScope(tournamentId, eventId)
  const entryRef = doc(collection(db, 'tournament_entries'))
  const batch = writeBatch(db)

  if (input.type === 'team') {
    const teamRef = doc(collection(db, 'teams'))
    batch.set(teamRef, {
      ...scope,
      name: input.name,
      organization: input.organization || null,
      seeded: input.seeded,
    })
    input.roster.forEach((name) => {
      batch.set(doc(collection(db, 'team_players')), { team_id: teamRef.id, name })
    })
    batch.set(entryRef, {
      ...scope,
      entry_type: 'team',
      team_id: teamRef.id,
      player_id: null,
      pair_id: null,
      seeded: input.seeded,
    })
  } else if (input.type === 'player') {
    const playerRef = doc(collection(db, 'players'))
    batch.set(playerRef, {
      ...scope,
      name: input.name,
      organization: input.organization || null,
      seeded: input.seeded,
    })
    batch.set(entryRef, {
      ...scope,
      entry_type: 'player',
      team_id: null,
      player_id: playerRef.id,
      pair_id: null,
      seeded: input.seeded,
    })
  } else {
    const pairRef = doc(collection(db, 'pairs'))
    batch.set(pairRef, {
      ...scope,
      pair_name: input.pair_name || null,
      player_a: input.player_a,
      player_b: input.player_b,
      organization: input.organization || null,
      seeded: input.seeded,
    })
    batch.set(entryRef, {
      ...scope,
      entry_type: 'pair',
      team_id: null,
      player_id: null,
      pair_id: pairRef.id,
      seeded: input.seeded,
    })
  }

  const entryId = entryRef.id

  if (assignment.mode === 'new_group') {
    const label = nextGroupLabel(groups.map((g) => g.label))
    const groupRef = doc(collection(db, 'groups'))
    batch.set(groupRef, { tournament_id: tournamentId, event_id: eventId, label })
    await batch.commit()

    const memberBatch = writeBatch(db)
    memberBatch.set(doc(collection(db, 'group_members')), {
      group_id: groupRef.id,
      entry_id: entryId,
    })
    await memberBatch.commit()
    return { entryId, warnings }
  }

  const group = groups.find((g) => g.id === assignment.groupId)
  if (!group) throw new Error('Group not found')

  const groupEntryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
  const groupEntries = groupEntryIds
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean) as TournamentEntry[]

  const validation = validateLateJoinTarget(groupEntries, mockEntry)
  if (!validation.ok) {
    throw new Error(validation.error ?? 'Cannot assign to this group')
  }
  warnings.push(...validation.warnings)

  batch.set(doc(collection(db, 'group_members')), {
    group_id: group.id,
    entry_id: entryId,
  })

  for (const [a, b] of newRoundRobinPairsForEntry(entryId, groupEntryIds)) {
    batch.set(doc(collection(db, 'group_matches')), {
      tournament_id: tournamentId,
      event_id: eventId,
      group_id: group.id,
      entry_a_id: a,
      entry_b_id: b,
      score_a: null,
      score_b: null,
      rubber_results: null,
      winner_entry_id: null,
      status: 'scheduled',
      outcome: 'normal',
    })
  }

  await batch.commit()
  return { entryId, warnings }
}

async function assertGroupStageEntryChangesAllowed(tournamentId: string, eventId: string) {
  const [event, knockout] = await Promise.all([
    fetchEvent(tournamentId, eventId),
    fetchKnockoutMatches(tournamentId, eventId),
  ])
  if (event.status !== 'ongoing') {
    throw new Error('Changes are only available during the group stage')
  }
  if (knockout.length > 0) {
    throw new Error('Cannot change entries after the knockout bracket has been generated')
  }
  return event
}

async function clearGroupManualRanks(groupIds: string[]) {
  const unique = [...new Set(groupIds)]
  await Promise.all(
    unique.map((groupId) =>
      updateDoc(doc(db, 'groups', groupId), {
        manual_rank_order: null,
        manual_rank_note: null,
      }),
    ),
  )
}

export async function moveEntryToGroup(
  tournamentId: string,
  eventId: string,
  entryId: string,
  targetGroupId: string,
): Promise<{ warnings: string[] }> {
  await assertGroupStageEntryChangesAllowed(tournamentId, eventId)

  const [groups, entries, groupMatches] = await Promise.all([
    fetchGroups(tournamentId, eventId),
    fetchEntries(tournamentId, eventId),
    fetchGroupMatches(tournamentId, eventId),
  ])

  if (!groups.length) {
    throw new Error('Group stage has not been generated yet')
  }

  const members = await fetchGroupMembers(
    tournamentId,
    eventId,
    groups.map((g) => g.id),
  )

  const entry = entries.find((e) => e.id === entryId)
  if (!entry) throw new Error('Entry not found')

  const member = members.find((m) => m.entry_id === entryId)
  if (!member) throw new Error('Entry is not assigned to a group')

  const sourceGroupId = member.group_id
  if (sourceGroupId === targetGroupId) {
    throw new Error('Entry is already in this group')
  }

  const targetGroup = groups.find((g) => g.id === targetGroupId)
  if (!targetGroup) throw new Error('Target group not found')

  const targetEntryIds = members
    .filter((m) => m.group_id === targetGroupId)
    .map((m) => m.entry_id)
  const targetEntries = targetEntryIds
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean) as TournamentEntry[]

  const validation = validateLateJoinTarget(targetEntries, entry)
  if (!validation.ok) {
    throw new Error(validation.error ?? 'Cannot move to this group')
  }

  const memberSnap = await getDocs(
    query(collection(db, 'group_members'), where('entry_id', '==', entryId)),
  )

  const batch = writeBatch(db)

  for (const match of groupMatches) {
    if (
      match.group_id === sourceGroupId &&
      (match.entry_a_id === entryId || match.entry_b_id === entryId)
    ) {
      batch.delete(doc(db, 'group_matches', match.id))
    }
  }

  for (const memberDoc of memberSnap.docs) {
    batch.delete(memberDoc.ref)
  }

  batch.set(doc(collection(db, 'group_members')), {
    group_id: targetGroupId,
    entry_id: entryId,
  })

  for (const [a, b] of newRoundRobinPairsForEntry(entryId, targetEntryIds)) {
    batch.set(doc(collection(db, 'group_matches')), {
      tournament_id: tournamentId,
      event_id: eventId,
      group_id: targetGroupId,
      entry_a_id: a,
      entry_b_id: b,
      score_a: null,
      score_b: null,
      rubber_results: null,
      winner_entry_id: null,
      status: 'scheduled',
      outcome: 'normal',
    })
  }

  await batch.commit()
  await clearGroupManualRanks([sourceGroupId, targetGroupId])

  return { warnings: validation.warnings }
}

async function loadEventForMatch(matchData: {
  tournament_id: string
  event_id: string
}): Promise<TournamentEvent> {
  return fetchEvent(matchData.tournament_id, matchData.event_id)
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

  const matchData = matchSnap.data()
  const event = await loadEventForMatch({
    tournament_id: matchData.tournament_id as string,
    event_id: matchData.event_id as string,
  })
  validateMatchResultSave(
    { id: matchId, ...matchData } as GroupMatch,
    update,
    { eventType: event.event_type, config: event.config, stage: 'group' },
  )

  await updateDoc(matchRef, { ...update, status: 'completed' })
}

export async function propagateKnockoutWinners(tournamentId: string, eventId: string) {
  const inflight = knockoutPropagationInflight.get(eventId)
  if (inflight) return inflight

  const promise = (async () => {
    const matches = await fetchKnockoutMatches(tournamentId, eventId)
    if (!matches.length) return

    const standingMap = await fetchAdvancerStandingMap(tournamentId, eventId)
    const updates = computeKnockoutAdvancement(matches, standingMap)
    const pendingUpdates: { id: string; patch: Record<string, unknown> }[] = []

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
        pendingUpdates.push({ id: m.id, patch })
      }
    }

    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      pendingUpdates.slice(i, i + BATCH_SIZE).forEach(({ id, patch }) => {
        batch.update(doc(db, 'knockout_matches', id), patch)
      })
      await batch.commit()
    }
  })()

  knockoutPropagationInflight.set(eventId, promise)
  try {
    await promise
  } finally {
    knockoutPropagationInflight.delete(eventId)
  }
}

async function fetchAdvancerStandingMap(
  tournamentId: string,
  eventId: string,
): Promise<Map<string, StandingRow>> {
  const event = await fetchEvent(tournamentId, eventId)
  const groups = await fetchGroups(tournamentId, eventId)
  const members = await fetchGroupMembers(tournamentId, eventId, groups.map((g) => g.id))
  const matches = await fetchGroupMatches(tournamentId, eventId)
  const entries = await fetchEntries(tournamentId, eventId)
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

function buildKnockoutTreeWrites(
  tournamentId: string,
  eventId: string,
  tree: KnockoutTreeNode[],
): PendingWrite[] {
  const keyToId = new Map<string, string>()
  for (const node of tree) {
    keyToId.set(node.key, doc(collection(db, 'knockout_matches')).id)
  }

  const pending: PendingWrite[] = []
  for (const node of tree) {
    const isBye = node.slot.isBye === true
    const matchId = keyToId.get(node.key)!
    pending.push({
      ref: doc(db, 'knockout_matches', matchId),
      data: {
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
      },
    })
  }
  return pending
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
  stage: 'quarters' | 'semis' | 'finals' = 'quarters',
) {
  const matchRef = doc(db, 'knockout_matches', matchId)
  const matchSnap = await getDoc(matchRef)
  if (!matchSnap.exists()) throw new Error('Match not found')

  const matchData = matchSnap.data()
  const event = await loadEventForMatch({
    tournament_id: matchData.tournament_id as string,
    event_id: matchData.event_id as string,
  })
  validateMatchResultSave(
    { id: matchId, ...matchData } as KnockoutMatch,
    update,
    { eventType: event.event_type, config: event.config, stage },
  )

  await updateDoc(matchRef, { ...update, status: 'completed' })

  const eventId = matchData.event_id as string
  const tournamentId = matchData.tournament_id as string
  try {
    await propagateKnockoutWinners(tournamentId, eventId)
  } catch (err) {
    console.error('Knockout advancement failed after saving match result', err)
    throw new Error('Score saved but bracket could not advance — refresh and try again')
  }
}

export async function generateKnockoutBracket(tournamentId: string, event: TournamentEvent) {
  const groups = await fetchGroups(tournamentId, event.id)
  const members = await fetchGroupMembers(tournamentId, event.id, groups.map((g) => g.id))
  const matches = await fetchGroupMatches(tournamentId, event.id)
  const entries = await fetchEntries(tournamentId, event.id)
  const entryMap = new Map(entries.map((e) => [e.id, e]))
  const advanceCount = event.config.advance_count
  const groupOrder = groups.map((g) => g.id)

  const standingsByGroup = new Map<string, ReturnType<typeof computeStandings>>()

  for (const group of groups) {
    const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
    const groupMatches = matches.filter((m) => m.group_id === group.id)

    const unplayed = groupMatches.filter((m) => m.status !== 'completed').length
    if (unplayed > 0) {
      throw new Error(
        `Group ${group.label} still has ${unplayed} unplayed match${unplayed === 1 ? '' : 'es'}`,
      )
    }

    const computed = computeStandings(entryIds, groupMatches, entryMap)
    if (needsManualRankResolution(computed) && !group.manual_rank_order?.length) {
      throw new Error(
        `Group ${group.label} has tied standings — set manual ranks before generating knockout`,
      )
    }

    standingsByGroup.set(
      group.id,
      resolveGroupStandings(entryIds, groupMatches, entryMap, group.manual_rank_order),
    )
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

  const existing = await getDocs(eventScopeQuery('knockout_matches', tournamentId, event.id))
  await deleteQueryDocs(existing.docs.map((d) => d.ref))

  if (tree.length) {
    await commitBatchSets(buildKnockoutTreeWrites(tournamentId, event.id, tree))
  }

  if (tree.length) {
    await propagateKnockoutWinners(tournamentId, event.id)
  }

  return warnings
}

export async function regenerateKnockoutFromRanks(tournamentId: string, eventId: string) {
  const existing = await fetchKnockoutMatches(tournamentId, eventId)
  if (existing.some((m) => m.status === 'completed')) {
    throw new Error('Cannot update knockout — some knockout matches are already scored')
  }
  const event = await fetchEvent(tournamentId, eventId)
  const recheck = await fetchKnockoutMatches(tournamentId, eventId)
  if (recheck.some((m) => m.status === 'completed')) {
    throw new Error('Cannot update knockout — a match was scored while regenerating')
  }
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
  const eventSnap = await getDoc(
    doc(db, 'tournaments', entry.tournament_id, 'events', entry.event_id),
  )
  if (!eventSnap.exists()) throw new Error('Division not found')
  const status = eventSnap.data().status as TournamentEvent['status']

  if (status !== 'draft' && status !== 'upcoming') {
    if (status === 'ongoing') {
      const knockout = await fetchKnockoutMatches(entry.tournament_id, entry.event_id)
      if (knockout.length > 0) {
        throw new Error('Cannot remove entries after the knockout bracket has been generated')
      }
    } else {
      throw new Error('Cannot remove entries after the division has ended')
    }
  }

  const memberSnap = await getDocs(
    query(collection(db, 'group_members'), where('entry_id', '==', entry.id)),
  )
  const affectedGroupIds = [
    ...new Set(memberSnap.docs.map((d) => d.data().group_id as string)),
  ]

  await deleteEntryReferences(entry.tournament_id, entry.event_id, entry.id)

  if (entry.team_id) {
    const roster = await getDocs(
      query(collection(db, 'team_players'), where('team_id', '==', entry.team_id)),
    )
    const batch = writeBatch(db)
    roster.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(doc(db, 'teams', entry.team_id))
    batch.delete(doc(db, 'tournament_entries', entry.id))
    await batch.commit()
  } else {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'tournament_entries', entry.id))
    if (entry.player_id) batch.delete(doc(db, 'players', entry.player_id))
    if (entry.pair_id) batch.delete(doc(db, 'pairs', entry.pair_id))
    await batch.commit()
  }

  if (affectedGroupIds.length) {
    await clearGroupManualRanks(affectedGroupIds)
  }
}
