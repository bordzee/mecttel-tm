import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

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

export const app = isFirebaseConfigured
  ? getApps().length
    ? getApps()[0]!
    : initializeApp(firebaseConfig)
  : getApps()[0] ?? initializeApp(demoConfig)

export const db = getFirestore(app)

// Storage is only used by organizers, so it is loaded on demand and stays out of the public bundle.
export async function getStorageService() {
  const { getStorage } = await import('firebase/storage')
  return getStorage(app)
}

/** Local development against the Firebase emulators: VITE_USE_EMULATOR=true npm run dev */
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8381)
  } catch {
    // Already connected (hot reload).
  }
}
