// Sign-in and session. This is the auth seam: `verify` decides whether a
// username/password pair is good, `loadSession`/`saveSession`/`clearSession`
// remember who is signed in across reloads. Swap the bodies for Firebase Auth
// (signInWithEmailAndPassword + onAuthStateChanged) and the rest of the app is
// untouched.

import { CREDENTIALS, SALT } from './credentials'

const SESSION_KEY = 'campaignlauncher.session'

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Returns the user id on success, null on a bad username or password. Takes the
 * same time either way so the response does not reveal which half was wrong.
 */
export async function verify(username: string, password: string): Promise<string | null> {
  const wanted = username.trim().toLowerCase()
  const hash = await sha256Hex(SALT + password)
  const match = CREDENTIALS.find((c) => c.username === wanted && c.passwordHash === hash)
  return match?.userId ?? null
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
