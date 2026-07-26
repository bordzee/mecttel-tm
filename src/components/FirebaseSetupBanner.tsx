import { isFirebaseConfigured } from '../lib/firebase'
import { WarningBanner } from './ui/primitives'

export function FirebaseSetupBanner() {
  if (isFirebaseConfigured) return null
  return (
    <WarningBanner>
      Firebase configuration missing — set variables in <code className="font-mono">.env</code> from{' '}
      <code className="font-mono">.env.example</code> and restart the dev server.
    </WarningBanner>
  )
}
