/**
 * Creates local test accounts in the Auth + Firestore emulators:
 *   admin@example.test       superadmin  (manages admins, sets the master password)
 *   plain.admin@example.test admin       (runs tournaments)
 *
 * Run (with emulators up): npm run seed:emulator-admin
 * Both use the password emulator-pass-1
 */
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8381'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9199'

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-tt-app'
const EMAIL = 'admin@example.test'
const PASSWORD = 'emulator-pass-1'

initializeApp({ projectId: PROJECT_ID })

async function ensure(email: string, role: 'admin' | 'superadmin') {
  const auth = getAuth()
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, password: PASSWORD }))
  await getFirestore().doc(`profiles/${user.uid}`).set({ role, email, created_at: new Date().toISOString(), created_by: 'seed' })
  console.log(`${role} ready: ${email} / ${PASSWORD}`)
}

async function main() {
  await ensure(EMAIL, 'superadmin')
  await ensure('plain.admin@example.test', 'admin')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
