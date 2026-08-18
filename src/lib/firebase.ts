import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !String(firebaseConfig.apiKey).includes('your-'),
)

export const isStorageConfigured = Boolean(
  isFirebaseConfigured &&
    firebaseConfig.storageBucket &&
    !String(firebaseConfig.storageBucket).includes('your-'),
)

/** File upload requires Storage on the Blaze plan — opt in via VITE_FIREBASE_IMAGE_UPLOAD=true */
export const isImageUploadEnabled = Boolean(
  isStorageConfigured && import.meta.env.VITE_FIREBASE_IMAGE_UPLOAD === 'true',
)

const demoConfig: FirebaseOptions = { apiKey: 'demo', projectId: 'demo', appId: 'demo' }

const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]!
    : initializeApp(firebaseConfig)
  : getApps()[0] ?? initializeApp(demoConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)
