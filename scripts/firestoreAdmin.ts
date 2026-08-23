import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Firestore } from '@google-cloud/firestore'
import { OAuth2Client } from 'google-auth-library'

const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'

type FirebaseToolsConfig = {
  tokens?: {
    access_token?: string
    refresh_token?: string
    expires_at?: number
  }
}

function firebaseToolsConfigPaths(): string[] {
  return [
    join(process.env.APPDATA ?? '', 'configstore', 'firebase-tools.json'),
    join(process.env.USERPROFILE ?? '', '.config', 'configstore', 'firebase-tools.json'),
    join(process.env.HOME ?? '', '.config', 'configstore', 'firebase-tools.json'),
  ]
}

function loadFirebaseToolsConfig(): FirebaseToolsConfig | null {
  for (const path of firebaseToolsConfigPaths()) {
    if (!existsSync(path)) continue
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as FirebaseToolsConfig
    } catch {
      continue
    }
  }
  return null
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLI_CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!body.access_token) {
    const detail = body.error_description ?? body.error ?? 'unknown'
    throw new Error(`Could not refresh Firebase CLI token (${detail}).`)
  }
  return body.access_token
}

async function accessTokenFromFirebaseCli(): Promise<string> {
  const cfg = loadFirebaseToolsConfig()
  const tokens = cfg?.tokens
  if (!tokens?.access_token && !tokens?.refresh_token) {
    throw new Error('Firebase CLI is not logged in.')
  }

  const expiresAt = tokens.expires_at ?? 0
  if (tokens.access_token && Date.now() < expiresAt - 60_000) {
    return tokens.access_token
  }

  if (!tokens.refresh_token) {
    throw new Error('Firebase CLI token expired.')
  }

  return refreshAccessToken(tokens.refresh_token)
}

function authHelpMessage(): string {
  return [
    'Firestore admin auth failed. Use one of:',
    '  1. npm run firebase:login   (then re-run the seed script)',
    '  2. Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON file',
  ].join('\n')
}

/** Admin Firestore client for local seed scripts. */
export async function getAdminFirestore(projectId: string): Promise<Firestore> {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath && existsSync(credPath)) {
    return new Firestore({ projectId, keyFilename: credPath })
  }

  if (loadFirebaseToolsConfig()?.tokens) {
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

  throw new Error(authHelpMessage())
}
