/**
 * Recreates the MECTTEL Singles – Open division (36 players, 8 groups, block knockout).
 *
 * Run: npm run seed:mecttel-open
 *
 * Uses Firebase CLI login on this machine (npx firebase login).
 */
import { EXPECTED_BLOCK_R16, MECTTEL_SINGLES_OPEN } from './mecttel-singles-open-data.ts'
import { getAdminFirestore } from './firestoreAdmin.ts'
import { generateRoundRobinPairs } from '../src/lib/roundRobin.ts'
import { generateKnockoutPairings, computeKnockoutAdvancement } from '../src/lib/knockoutSeeding.ts'
import { resolveGroupStandings, getTopAdvancers } from '../src/lib/standings.ts'
import type { TournamentEntry, KnockoutMatch } from '../src/types/index.ts'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'table-tennis-tournament-app'

type PlayerDef = { name: string; organization: string }

function orgOrNull(org: string) {
  const trimmed = org.trim()
  return trimmed || null
}

function strengthRank(groupPlayers: PlayerDef[], entryId: string, entryNameById: Map<string, string>) {
  const name = entryNameById.get(entryId)
  const idx = groupPlayers.findIndex((p) => p.name === name)
  return idx >= 0 ? idx : 999
}

async function main() {
  const db = await getAdminFirestore(PROJECT_ID)
  const now = new Date().toISOString()
  const { tournament: tDef, event: eDef, groups: groupDefs } = MECTTEL_SINGLES_OPEN

  console.log('Creating tournament…')
  const tournamentRef = db.collection('tournaments').doc()
  await tournamentRef.set({
    name: tDef.name,
    venue: tDef.venue,
    start_date: tDef.start_date,
    image_url: null,
    public_visible: true,
    created_at: now,
  })

  console.log('Creating Singles – Open division…')
  const eventRef = tournamentRef.collection('events').doc()
  await eventRef.set({
    tournament_id: tournamentRef.id,
    name: eDef.name,
    event_type: eDef.event_type,
    category: eDef.category,
    config: eDef.config,
    status: eDef.status,
    sort_order: 0,
    created_at: now,
  })

  const tournamentId = tournamentRef.id
  const eventId = eventRef.id

  console.log('Adding 36 entries…')
  const entryIdsByName = new Map<string, string>()
  const entryMap = new Map<string, TournamentEntry>()

  for (const group of groupDefs) {
    for (const player of group.players) {
      const playerRef = db.collection('players').doc()
      const entryRef = db.collection('tournament_entries').doc()
      const org = orgOrNull(player.organization)

      await playerRef.set({
        tournament_id: tournamentId,
        event_id: eventId,
        name: player.name,
        organization: org,
        seeded: null,
      })

      await entryRef.set({
        tournament_id: tournamentId,
        event_id: eventId,
        entry_type: 'player',
        team_id: null,
        player_id: playerRef.id,
        pair_id: null,
        seeded: null,
      })

      entryIdsByName.set(player.name, entryRef.id)
      entryMap.set(entryRef.id, {
        id: entryRef.id,
        tournament_id: tournamentId,
        event_id: eventId,
        entry_type: 'player',
        team_id: null,
        player_id: playerRef.id,
        pair_id: null,
        seeded: null,
        player: {
          id: playerRef.id,
          tournament_id: tournamentId,
          event_id: eventId,
          name: player.name,
          organization: org,
          seeded: null,
        },
      })
    }
  }

  console.log('Building groups, round-robin matches, and group scores…')
  const groupIds: string[] = []
  const groupIdByLabel = new Map<string, string>()

  for (const groupDef of groupDefs) {
    const groupRef = db.collection('groups').doc()
    groupIds.push(groupRef.id)
    groupIdByLabel.set(groupDef.label, groupRef.id)

    await groupRef.set({
      tournament_id: tournamentId,
      event_id: eventId,
      label: groupDef.label,
    })

    const entryIds = groupDef.players.map((p) => entryIdsByName.get(p.name)!)
    for (const entryId of entryIds) {
      await db.collection('group_members').doc().set({
        group_id: groupRef.id,
        entry_id: entryId,
      })
    }

    const entryNameById = new Map(entryIds.map((id) => [id, entryMap.get(id)!.player!.name]))
    const pairs = generateRoundRobinPairs(entryIds)

    for (const [a, b] of pairs) {
      const rankA = strengthRank(groupDef.players, a, entryNameById)
      const rankB = strengthRank(groupDef.players, b, entryNameById)
      const aWins = rankA <= rankB
      const winner = aWins ? a : b

      await db.collection('group_matches').doc().set({
        tournament_id: tournamentId,
        event_id: eventId,
        group_id: groupRef.id,
        entry_a_id: a,
        entry_b_id: b,
        score_a: aWins ? 3 : 1,
        score_b: aWins ? 1 : 3,
        rubber_results: null,
        winner_entry_id: winner,
        status: 'completed',
        outcome: 'normal',
      })
    }
  }

  console.log('Generating block knockout bracket…')
  const groupsSnap = await db
    .collection('groups')
    .where('tournament_id', '==', tournamentId)
    .where('event_id', '==', eventId)
    .get()
  const groups = groupsSnap.docs
    .map((d) => ({ id: d.id, label: d.data().label as string }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const membersSnap = await db.collection('group_members').get()
  const members = membersSnap.docs
    .map((d) => d.data() as { group_id: string; entry_id: string })
    .filter((m) => groupIds.includes(m.group_id))

  const matchesSnap = await db
    .collection('group_matches')
    .where('tournament_id', '==', tournamentId)
    .where('event_id', '==', eventId)
    .get()
  const groupMatches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const standingsByGroup = new Map<string, ReturnType<typeof resolveGroupStandings>>()
  for (const group of groups) {
    const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
    const gMatches = groupMatches.filter((m) => m.group_id === group.id)
    standingsByGroup.set(
      group.id,
      resolveGroupStandings(entryIds, gMatches as never, entryMap, null),
    )
  }

  const advancers = getTopAdvancers(standingsByGroup, eDef.config.advance_count)
  const groupOrder = groups.map((g) => g.id)

  const { tree, warnings } = generateKnockoutPairings(
    advancers,
    groupOrder,
    entryMap,
    eDef.config.advance_count,
    eDef.config.knockout_bracket ?? 'cross',
  )

  if (warnings.length) {
    console.log('Knockout warnings:')
    for (const w of warnings) console.log(' -', w.message)
  }

  const keyToId = new Map<string, string>()
  for (const node of tree) {
    keyToId.set(node.key, db.collection('knockout_matches').doc().id)
  }

  for (const node of tree) {
    const isBye = node.slot.isBye === true
    const matchId = keyToId.get(node.key)!
    await db.collection('knockout_matches').doc(matchId).set({
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
      source_match_a_id: node.slot.sourceAKey ? (keyToId.get(node.slot.sourceAKey) ?? null) : null,
      source_match_b_id: node.slot.sourceBKey ? (keyToId.get(node.slot.sourceBKey) ?? null) : null,
      source_feeder: node.slot.sourceFeeder ?? null,
      pending_odd_round: node.slot.pendingOddRound ?? false,
      is_odd_play_in: node.slot.isOddPlayIn ?? false,
      feeder_source_match_ids: (node.slot.feederSourceKeys ?? [])
        .map((key) => keyToId.get(key))
        .filter((id): id is string => !!id),
      status: isBye ? 'completed' : node.slot.entryAId && node.slot.entryBId ? 'scheduled' : 'pending',
      outcome: isBye ? 'bye' : 'normal',
    })
  }

  // Propagate bye / placeholder wiring once.
  let kmSnap = await db
    .collection('knockout_matches')
    .where('tournament_id', '==', tournamentId)
    .where('event_id', '==', eventId)
    .get()

  const standingMap = new Map<string, { entryId: string; name: string }>()
  for (const rows of advancers.values()) {
    for (const row of rows) standingMap.set(row.entryId, row)
  }

  for (let pass = 0; pass < 8; pass++) {
    const matches: KnockoutMatch[] = kmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KnockoutMatch))
    const updates = computeKnockoutAdvancement(matches, standingMap as never)
    if (!updates.size) break

    const batch = db.batch()
    let changed = 0
    for (const m of matches) {
      const patch = updates.get(m.id)
      if (!patch) continue
      batch.update(db.collection('knockout_matches').doc(m.id), patch as Record<string, unknown>)
      changed++
    }
    if (!changed) break
    await batch.commit()
    kmSnap = await db
      .collection('knockout_matches')
      .where('tournament_id', '==', tournamentId)
      .where('event_id', '==', eventId)
      .get()
  }

  const r16Snap = await db
    .collection('knockout_matches')
    .where('tournament_id', '==', tournamentId)
    .where('event_id', '==', eventId)
    .where('round', '==', 'r16')
    .get()

  const r16Pairings = r16Snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.slot as number) - (b.slot as number))
    .map((m) => {
      const a = entryMap.get(m.entry_a_id as string)?.player?.name ?? '?'
      const b = entryMap.get(m.entry_b_id as string)?.player?.name ?? '?'
      return `${a} vs ${b}`
    })

  console.log('\nDone.')
  console.log('Tournament ID:', tournamentId)
  console.log('Event ID:', eventId)
  console.log('Admin:', `/admin/tournaments/${tournamentId}/events/${eventId}`)
  console.log('Public:', `/tournaments/${tournamentId}/events/${eventId}`)

  console.log('\nBlock R16 pairings:')
  for (const p of r16Pairings) console.log(' -', p)

  const missing = EXPECTED_BLOCK_R16.filter((expected) => !r16Pairings.includes(expected))
  if (missing.length) {
    console.warn('\nUnexpected R16 pairings (check group standings):', missing)
    process.exitCode = 1
  } else {
    console.log('\nR16 matches expected block pairings from yesterday.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
