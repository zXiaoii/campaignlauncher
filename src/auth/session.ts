// Sign-in and session, local backend. This is the auth seam: `verify` decides
// whether a username/password pair is good, `loadSession`/`saveSession`/
// `clearSession` remember who is signed in across reloads. The Firebase
// implementation in `firebase.ts` fulfils the same contract.
//
// Two places a password can be checked: the original six in `credentials.ts`,
// and people added through the Team screen, whose hash is stored on their user
// record in the local database.

import { CREDENTIALS, SALT } from './credentials'

const SESSION_KEY = 'campaignlauncher.session'

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Salted hash of a password — what gets stored for a Team-screen user locally. */
export function hashPassword(password: string): Promise<string> {
  return sha256Hex(SALT + password)
}

/**
 * Returns the user id on success, null on a bad username or password. Takes the
 * same time either way so the response does not reveal which half was wrong.
 */
export async function verify(username: string, password: string): Promise<string | null> {
  const wanted = username.trim().toLowerCase()
  const hash = await hashPassword(password)

  const seeded = CREDENTIALS.find((c) => c.username === wanted && c.passwordHash === hash)
  if (seeded) return seeded.userId

  // People added through the Team screen: hash lives on their user record.
  const { loadDatabase } = await import('../db/local')
  const { db } = await loadDatabase()
  const user = db.users.find((u) => u.username === wanted && u.active && u.passwordHash === hash)
  return user?.id ?? null
}

export function loadSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function saveSession(userId: string): void {
  try {
    window.localStorage.setItem(SESSION_KEY, userId)
  } catch {
    /* private mode — the session lasts until the tab closes */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* nothing to clear */
  }
}

/** Local backend: nothing to create remotely — return the hash to store on the user. */
export async function createAccount(_username: string, password: string): Promise<{ passwordHash?: string }> {
  return { passwordHash: await hashPassword(password) }
}
