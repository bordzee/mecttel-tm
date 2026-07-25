import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'

/** Firestore rejects `undefined`; omit those fields before writes. */
export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) out[key] = stripUndefined(val)
  }
  return out as T
}

const BATCH_SIZE = 450

async function deleteQueryDocs(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function deleteWhere(collectionName: string, field: string, value: string) {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)))
  await deleteQueryDocs(snap.docs.map((d) => d.ref))
}

export { deleteWhere }

async function deleteEventScopedData(tournamentId: string, eventId: string) {
  const teamsSnap = await getDocs(
    query(collection(db, 'teams'), where('event_id', '==', eventId)),
  )
  for (const teamDoc of teamsSnap.docs) {
    await deleteWhere('team_players', 'team_id', teamDoc.id)
  }

  const groupsSnap = await getDocs(
    query(collection(db, 'groups'), where('event_id', '==', eventId)),
  )
  for (const groupDoc of groupsSnap.docs) {
    await deleteWhere('group_members', 'group_id', groupDoc.id)
  }

  const collections = [
    'teams',
    'players',
    'pairs',
    'tournament_entries',
    'groups',
    'group_matches',
    'knockout_matches',
  ] as const

  for (const name of collections) {
    await deleteWhere(name, 'event_id', eventId)
  }

  await deleteQueryDocs([doc(db, 'tournaments', tournamentId, 'events', eventId)])
}

export async function deleteEventData(tournamentId: string, eventId: string) {
  await deleteEventScopedData(tournamentId, eventId)
}

export async function deleteTournamentData(tournamentId: string) {
  const eventsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'events'))
  for (const eventDoc of eventsSnap.docs) {
    await deleteEventScopedData(tournamentId, eventDoc.id)
  }
  await deleteQueryDocs([doc(db, 'tournaments', tournamentId)])
}
