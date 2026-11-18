import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { app } from './firebase'

// Auth is only needed on organizer pages, so it lives in its own module and
// stays out of the public bundle.
export const auth = getAuth(app)

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
  } catch {
    // Already connected (hot reload).
  }
}
