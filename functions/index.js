const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp()

exports.createAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in')
  }

  const db = getFirestore()
  const profile = await db.doc(`profiles/${request.auth.uid}`).get()
  if (!profile.exists || profile.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only')
  }

  const { email, password } = request.data ?? {}
  if (!email || !password || password.length < 8) {
    throw new HttpsError('invalid-argument', 'Valid email and password (8+ chars) required')
  }

  const auth = getAuth()
  const user = await auth.createUser({ email, password })
  await db.doc(`profiles/${user.uid}`).set({
    role: 'admin',
    created_at: new Date().toISOString(),
  })

  return { success: true, uid: user.uid }
})
