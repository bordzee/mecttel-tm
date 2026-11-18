/**
 * Superadmin tool for things the app cannot do from the browser on the free Firebase plan.
 *
 *   npm run admin-tool -- list
 *   npm run admin-tool -- create <email>           makes an admin with a generated password
 *   npm run admin-tool -- reset-password <email>   sets a new generated password
 *   npm run admin-tool -- remove <email>           deletes the login and the admin profile
 *   npm run admin-tool -- promote <email>          makes an existing account the superadmin
 *
 * It uses the Firebase Admin SDK, so it needs a service-account key from the Firebase console
 * (Project settings > Service accounts > Generate new private key). Keep that file private:
 *
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\keys\tt-admin.json      (Windows)
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/tt-admin.json     (macOS/Linux)
 *
 * For the local emulators set FIRESTORE_EMULATOR_HOST=127.0.0.1:8381 and
 * FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 instead (no key needed).
 */
import { randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generatePassword(length = 14): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

function projectId(): string {
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID
  try {
    return JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default as string
  } catch {
    throw new Error('Cannot tell which Firebase project to use. Set VITE_FIREBASE_PROJECT_ID.')
  }
}

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
initializeApp(usingEmulator ? { projectId: projectId() } : { projectId: projectId(), credential: applicationDefault() })
const auth = getAuth()
const db = getFirestore()

function need(email: string | undefined): string {
  if (!email || !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) throw new Error('Give a valid email address')
  return email.trim().toLowerCase()
}

async function main() {
  const [command, rawEmail] = process.argv.slice(2)

  if (command === 'list') {
    const snap = await db.collection('profiles').get()
    if (snap.empty) console.log('No admin profiles yet.')
    for (const d of snap.docs) console.log(`${(d.data().email ?? '(no email)').padEnd(36)} ${String(d.data().role).padEnd(11)} ${d.id}`)
    return
  }

  const email = need(rawEmail)

  if (command === 'create') {
    const password = generatePassword()
    const user = await auth.createUser({ email, password })
    await db.doc(`profiles/${user.uid}`).set({ role: 'admin', email, created_at: new Date().toISOString(), created_by: 'admin-tool' })
    console.log(`Admin created.\n  email:    ${email}\n  password: ${password}\nGive these to the admin; they can change the password under Account.`)
    return
  }

  if (command === 'reset-password') {
    const user = await auth.getUserByEmail(email)
    const password = generatePassword()
    await auth.updateUser(user.uid, { password })
    console.log(`New password for ${email}: ${password}\nGive it to them; they can change it under Account.`)
    return
  }

  if (command === 'remove') {
    const user = await auth.getUserByEmail(email)
    const profile = await db.doc(`profiles/${user.uid}`).get()
    if (profile.exists && profile.data()?.role === 'superadmin') throw new Error('Refusing to remove the superadmin')
    await db.doc(`profiles/${user.uid}`).delete()
    await auth.deleteUser(user.uid)
    console.log(`Removed ${email}: login and admin profile deleted.`)
    return
  }

  if (command === 'promote') {
    const user = await auth.getUserByEmail(email)
    await db.doc(`profiles/${user.uid}`).set({ role: 'superadmin', email, created_at: new Date().toISOString(), created_by: 'admin-tool' }, { merge: true })
    console.log(`${email} is now the superadmin.`)
    return
  }

  console.log('Commands: list | create <email> | reset-password <email> | remove <email> | promote <email>')
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
