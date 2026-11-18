import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { deleteEventData, deleteTournamentData } from './firebaseHelpers'
import { deleteTournamentImageFiles } from './tournamentImageService'
import { syncTournamentPublicVisibility } from './tournamentService'

/**
 * Irreversible deletes (a division, or a whole tournament) need the master password.
 *
 * How it is enforced without a server: the password's SHA-256 proof is stored in
 * system/config, which nobody can read. To delete, the admin first writes a
 * "delete grant" containing the proof they computed. Security rules accept that write
 * only if it matches the stored proof, and accept the delete itself only while a
 * matching grant exists (3 minutes). A wrong password therefore stops everything
 * before any data is touched.
 *
 * This is a guard against accidents and casual misuse. Rules cannot count wrong
 * guesses, so use a long password.
 */
export async function masterPasswordProof(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`tt-master-password:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function currentUid(): Promise<string> {
  const { auth } = await import('./firebaseAuth')
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are signed out. Sign in again.')
  return uid
}

async function withGrant(grantId: string, password: string, run: () => Promise<void>) {
  const uid = await currentUid()
  const grantRef = doc(db, 'delete_grants', grantId)
  try {
    await setDoc(grantRef, { uid, proof: await masterPasswordProof(password), created_at: serverTimestamp() })
  } catch {
    throw new Error('Wrong master password, or none has been set yet. Nothing was deleted.')
  }
  try {
    await run()
  } finally {
    // The grant is single use; ignore failures (it also expires on its own).
    await deleteDoc(grantRef).catch(() => {})
  }
}

/** Deletes one division and all of its entries, groups and matches. */
export async function deleteDivision(tournamentId: string, eventId: string, masterPassword: string) {
  await withGrant(`event-${eventId}`, masterPassword, async () => {
    await deleteEventData(tournamentId, eventId)
    await syncTournamentPublicVisibility(tournamentId)
  })
}

/** Deletes a tournament and every division in it. */
export async function deleteTournament(tournamentId: string, masterPassword: string) {
  await withGrant(`tournament-${tournamentId}`, masterPassword, async () => {
    await deleteTournamentData(tournamentId)
    void deleteTournamentImageFiles(tournamentId).catch(() => {})
  })
}

/** Superadmin only: replaces the master password. */
export async function setMasterPassword(password: string) {
  if (password.length < 10) throw new Error('Use at least 10 characters for the master password')
  await setDoc(doc(db, 'system', 'config'), {
    master_proof: await masterPasswordProof(password),
    updated_at: new Date().toISOString(),
  })
}
