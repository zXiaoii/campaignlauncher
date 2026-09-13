// Firebase Auth implementation of the auth seam. Usernames stay as they are;
// Firebase needs an email, so `charles` becomes `charles@campaign-launcher.app`
// — a synthetic address nobody reads.
//
// First sign-in provisions the account: if Firebase has no user for that email,
// the password is checked against the same hash the local auth uses, and only a
// correct password creates the Firebase user. So the team keeps the passwords in
// CREDENTIALS.md and nobody has to set up six accounts in the console. After
// that, the hash is never consulted again — Firebase Auth owns the password.

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'

import { firebaseAuth } from '../firebase/config'
import { CREDENTIALS } from './credentials'
import { verify as verifyLocally } from './session'

const EMAIL_DOMAIN = 'campaign-launcher.app'

const emailFor = (username: string) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`

function userIdFor(user: FirebaseUser | null): string | null {
  const username = user?.email?.split('@')[0]
  return CREDENTIALS.find((c) => c.username === username)?.userId ?? null
}

/** Turns a Firebase Auth error into something the person at the keyboard can act on. */
export class AuthSetupError extends Error {}

function explain(code: string): string | null {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase yet. In the console: Authentication → Sign-in method → Email/Password → Enable.'
    case 'auth/configuration-not-found':
      return 'Firebase Authentication has not been set up for this project yet. In the console: Authentication → Get started.'
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check the connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts — Firebase has paused sign-in for this account for a while.'
    case 'auth/unauthorized-domain':
      return 'This site is not on the Firebase authorized domains list. Authentication → Settings → Authorized domains.'
    default:
      return null
  }
}

export async function verify(username: string, password: string): Promise<string | null> {
  const auth = firebaseAuth()
  const email = emailFor(username)
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return userIdFor(cred.user)
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? ''
    const setup = explain(code)
    if (setup) throw new AuthSetupError(setup)
    const noAccountYet =
      code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials'
    if (!noAccountYet) return null
    // Maybe this person has simply never signed in on Firebase. Provision only
    // on a password that matches the known hash.
    const localId = await verifyLocally(username, password)
    if (!localId) return null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      return userIdFor(cred.user) ?? localId
    } catch (e2: unknown) {
      const code2 = (e2 as { code?: string }).code ?? ''
      const setup2 = explain(code2)
      if (setup2) throw new AuthSetupError(setup2)
      // Account exists but the password differs from the hash → it was changed
      // in Firebase. That is the real password now; the first attempt was wrong.
      return null
    }
  }
}

/** Resolves once Firebase has restored (or not) the persisted session. */
export function getSession(): Promise<string | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(firebaseAuth(), (user) => {
      unsub()
      resolve(userIdFor(user))
    })
  })
}

/** Firebase persists its own session; nothing to store. */
export async function saveSession(): Promise<void> {}

export async function clearSession(): Promise<void> {
  await signOut(firebaseAuth())
}
