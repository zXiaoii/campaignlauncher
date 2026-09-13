// Firebase Auth implementation of the auth seam. Usernames stay as they are;
// Firebase needs an email, so `charles` becomes `charles@campaign-launcher.app`
// — a synthetic address nobody reads. A user's id is always `u_` + username, so
// the email alone identifies the user record.
//
// First sign-in of one of the original six provisions the account: if Firebase
// has no user for that email, the password is checked against the hash in
// credentials.ts and only a correct password creates the Firebase user. People
// added through the Team screen are created in Firebase Auth directly.

import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'

import { firebaseAuth } from '../firebase/config'
import { firebaseConfig } from '../firebase/env'
import { verify as verifyLocally } from './session'

const EMAIL_DOMAIN = 'campaign-launcher.app'

const emailFor = (username: string) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`

function userIdFor(user: FirebaseUser | null): string | null {
  const username = user?.email?.split('@')[0]
  return username ? `u_${username}` : null
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
    case 'auth/weak-password':
      return 'Firebase wants a password of at least 6 characters.'
    case 'auth/email-already-in-use':
      return 'That username already has a Firebase account.'
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
    // One of the original six who has never signed in on Firebase? Provision only
    // on a password that matches the known hash.
    const localId = await verifyLocally(username, password)
    if (!localId) return null
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      return userIdFor(cred.user) ?? localId
    } catch (e2: unknown) {
      const code2 = (e2 as { code?: string }).code ?? ''
      const setup2 = explain(code2)
      if (setup2 && code2 !== 'auth/email-already-in-use') throw new AuthSetupError(setup2)
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

/**
 * Creates a Firebase Auth account for a new team member without disturbing the
 * signed-in admin: `createUserWithEmailAndPassword` signs the *new* user in on
 * whichever Auth instance it runs against, so it runs against a throwaway
 * secondary app that is signed out and deleted straight after.
 */
export async function createAccount(username: string, password: string): Promise<{ passwordHash?: string }> {
  const secondary = initializeApp(firebaseConfig, `provision-${Date.now()}`)
  try {
    const auth = getAuth(secondary)
    await createUserWithEmailAndPassword(auth, emailFor(username), password)
    await signOut(auth)
    return {}
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? ''
    throw new AuthSetupError(explain(code) ?? `Firebase refused to create the account (${code || 'unknown error'}).`)
  } finally {
    await deleteApp(secondary).catch(() => {})
  }
}
