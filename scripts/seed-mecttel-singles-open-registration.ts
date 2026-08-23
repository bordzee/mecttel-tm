/**
 * Creates MECTTEL Singles – Open with all 36 players registered only (no groups/matches).
 *
 * Run: npm run seed:mecttel-registration
 */
import {
  MECTTEL_SINGLES_OPEN_REGISTRATION,
  mecttelSinglesOpenPlayers,
} from './mecttel-singles-open-data.ts'
import { getAdminFirestore } from './firestoreAdmin.ts'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'table-tennis-tournament-app'

function orgOrNull(org: string) {
  const trimmed = org.trim()
  return trimmed || null
}

async function main() {
  const db = await getAdminFirestore(PROJECT_ID)
  const now = new Date().toISOString()
  const { tournament: tDef, event: eDef } = MECTTEL_SINGLES_OPEN_REGISTRATION
  const players = mecttelSinglesOpenPlayers()

  console.log('Creating tournament (registration only)…')
  const tournamentRef = db.collection('tournaments').doc()
  await tournamentRef.set({
    name: tDef.name,
    venue: tDef.venue,
    start_date: tDef.start_date,
    image_url: null,
    public_visible: true,
    created_at: now,
  })

  console.log('Creating Singles – Open division (upcoming, no groups)…')
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

  console.log(`Adding ${players.length} entries…`)
  for (const player of players) {
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
  }

  console.log('\nDone.')
  console.log('Tournament ID:', tournamentId)
  console.log('Event ID:', eventId)
  console.log('Admin:', `/admin/tournaments/${tournamentId}/events/${eventId}`)
  console.log('Public:', `/tournaments/${tournamentId}/events/${eventId}`)
  console.log('\nDivision is upcoming — edit table count in division settings, then Ready → generate groups.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
