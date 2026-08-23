import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OAuth2Client } from 'google-auth-library'
import { Firestore } from '@google-cloud/firestore'

const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'

function loadFirebaseToolsConfig() {
  const path = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.config/configstore/firebase-tools.json')
  return JSON.parse(readFileSync(path, 'utf8')) as {
    tokens?: {
      access_token?: string
      refresh_token?: string
      expires_at?: number
    }
  }
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
  const body = (await res.json()) as { access_token?: string; error?: string }
  if (!body.access_token) {
    throw new Error(
      `Could not refresh Firebase CLI token (${body.error ?? 'unknown'}). Run: npx firebase login`,
    )
  }
  return body.access_token
}

export async function getAdminFirestore(projectId: string): Promise<Firestore> {
  const cfg = loadFirebaseToolsConfig()
  const tokens = cfg.tokens
  if (!tokens?.access_token && !tokens?.refresh_token) {
    throw new Error('Firebase CLI is not logged in. Run: npx firebase login')
  }

  let accessToken = tokens.access_token
  const expiresAt = tokens.expires_at ?? 0
  if (!accessToken || Date.now() > expiresAt - 60_000) {
    if (!tokens.refresh_token) {
      throw new Error('Firebase CLI token expired. Run: npx firebase login')
    }
    accessToken = await refreshAccessToken(tokens.refresh_token)
  }

  const auth = new OAuth2Client()
  auth.setCredentials({ access_token: accessToken })
  return new Firestore({ projectId, authClient: auth })
}
