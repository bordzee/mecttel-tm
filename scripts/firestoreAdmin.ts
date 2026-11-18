import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Firestore } from '@google-cloud/firestore'
import { OAuth2Client } from 'google-auth-library'

const require = createRequire(import.meta.url)
const firebaseAuth = require('firebase-tools/lib/auth') as {
  getAccessToken: (
    refreshToken: string,
    authScopes: string[],
  ) => Promise<{ access_token: string }>
}
const firebaseConfigstore = require('firebase-tools/lib/configstore') as {
  configstore: { get: (key: string) => unknown }
}

function authHelpMessage(): string {
  return [
    'Firestore admin auth failed. Use one of:',
    '  1. npm run firebase:login -- --reauth   (then re-run the seed script)',
    '  2. Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON file',
  ].join('\n')
}

async function accessTokenFromFirebaseCli(): Promise<string> {
  const tokens = firebaseConfigstore.configstore.get('tokens') as
    | { refresh_token?: string; scopes?: string[] }
    | undefined

  if (!tokens?.refresh_token) {
    throw new Error('Firebase CLI is not logged in.')
  }

  const result = await firebaseAuth.getAccessToken(tokens.refresh_token, tokens.scopes ?? [])
  if (!result.access_token) {
    throw new Error('Firebase CLI returned no access token.')
  }
  return result.access_token
}

/** Admin Firestore client for local seed scripts. */
export async function getAdminFirestore(projectId: string): Promise<Firestore> {
  // Emulator: no credentials needed (set FIRESTORE_EMULATOR_HOST=127.0.0.1:8381).
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return new Firestore({ projectId })
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath && existsSync(credPath)) {
    return new Firestore({ projectId, keyFilename: credPath })
  }

  try {
    const accessToken = await accessTokenFromFirebaseCli()
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: accessToken })
    return new Firestore({ projectId, authClient: auth })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`${authHelpMessage()}\n\n${detail}`)
  }
}
