import {
  collection,
  doc,
  getDocs,
  limit,
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
const QUERY_PAGE = 400

export async function deleteQueryDocs(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    refs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function deleteWhere(collectionName: string, field: string, value: string) {
  while (true) {
    const snap = await getDocs(
      query(
        collection(db, collectionName),
        where(field, '==', value),
        limit(QUERY_PAGE),
      ),
    )
    if (snap.empty) break
    await deleteQueryDocs(snap.docs.map((d) => d.ref))
    if (snap.size < QUERY_PAGE) break
  }
}

export { deleteWhere }

async function deleteEntryMatchReferences(eventId: string, entryId: string) {
  const groupMemberSnap = await getDocs(
    query(collection(db, 'group_members'), where('entry_id', '==', entryId)),
  )
  if (groupMemberSnap.docs.length) {
    await deleteQueryDocs(groupMemberSnap.docs.map((d) => d.ref))
  }

  for (const coll of ['group_matches', 'knockout_matches'] as const) {
    const snap = await getDocs(
      query(collection(db, coll), where('event_id', '==', eventId)),
    )
    const refs = snap.docs
      .filter((d) => {
        const data = d.data()
        return (
          data.entry_a_id === entryId ||
          data.entry_b_id === entryId ||
          data.winner_entry_id === entryId
        )
      })
      .map((d) => d.ref)
    if (refs.length) await deleteQueryDocs(refs)
  }
}

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

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 400 * i))
      }
    }
  }
  throw lastError
}

export async function deleteEntryReferences(eventId: string, entryId: string) {
  await deleteEntryMatchReferences(eventId, entryId)
}

export async function deleteEventData(tournamentId: string, eventId: string) {
  await withRetry(() => deleteEventScopedData(tournamentId, eventId))
}

export async function deleteTournamentData(tournamentId: string) {
  await withRetry(async () => {
    const eventsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'events'))
    for (const eventDoc of eventsSnap.docs) {
      await deleteEventScopedData(tournamentId, eventDoc.id)
    }
    await deleteQueryDocs([doc(db, 'tournaments', tournamentId)])
  })
}
