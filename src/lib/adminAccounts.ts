import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { app, db } from './firebase'
import { auth } from './firebaseAuth'
import type { Profile } from '../types'

const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** A readable random password (no look-alike characters such as 0/O or 1/l/I). */
export function generatePassword(length = 14): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join('')
}

export const MIN_PASSWORD_LENGTH = 8

export async function listAdmins(): Promise<Profile[]> {
  const snap = await getDocs(collection(db, 'profiles'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Profile)
    .sort((a, b) => (a.role === b.role ? (a.email ?? a.id).localeCompare(b.email ?? b.id) : a.role === 'superadmin' ? -1 : 1))
}

/**
 * Superadmin only. Creates the login and the admin profile, and returns the generated
 * password so it can be handed to the new admin. The password is not stored anywhere.
 *
 * The login is made on a second, temporary Firebase app so the superadmin stays signed in.
 */
export async function createAdminAccount(email: string, createdBy: string): Promise<{ uid: string; password: string }> {
  const cleaned = email.trim().toLowerCase()
  if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(cleaned)) throw new Error('Enter a valid email address')
  const password = generatePassword()

  const helper = initializeApp(app.options, `admin-creator-${Date.now()}`)
  const helperAuth = getAuth(helper)
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectAuthEmulator(helperAuth, 'http://127.0.0.1:9199', { disableWarnings: true })
  }
  try {
    let created
    try {
      created = await createUserWithEmailAndPassword(helperAuth, cleaned, password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        throw new Error(
          'A login with this email already exists. If that admin was removed earlier, delete the old login with the admin tool or the Firebase console first.',
        )
      }
      if (code === 'auth/invalid-email') throw new Error('Enter a valid email address')
      throw new Error('Could not create the login. Check your connection and try again.')
    }
    try {
      await setDoc(doc(db, 'profiles', created.user.uid), {
        role: 'admin',
        email: cleaned,
        created_at: new Date().toISOString(),
        created_by: createdBy,
      })
    } catch {
      // Do not leave a login without a profile behind.
      await deleteUser(created.user).catch(() => {})
      throw new Error('Could not save the admin profile. Nothing was created.')
    }
    return { uid: created.user.uid, password }
  } finally {
    await signOut(helperAuth).catch(() => {})
    await deleteApp(helper).catch(() => {})
  }
}

/**
 * Superadmin only. Takes away admin access immediately. The login itself remains until
 * it is deleted with the admin tool or the Firebase console, but it no longer opens anything.
 */
export async function removeAdminAccess(uid: string) {
  await deleteDoc(doc(db, 'profiles', uid))
}

/** Emails the admin a link to choose a new password. */
export async function sendAdminPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email)
}

/** Lets the signed-in admin change their own password. */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('You are signed out. Sign in again.')
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters`)
  if (newPassword === currentPassword) throw new Error('Choose a password different from the current one')
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/too-many-requests') throw new Error('Too many attempts. Wait a few minutes and try again.')
    throw new Error('The current password is wrong')
  }
  try {
    await updatePassword(user, newPassword)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/weak-password') throw new Error('That password is too weak')
    throw new Error('Could not change the password. Try again.')
  }
}
