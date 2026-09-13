// Firebase SDK handles. Import this only from the Firebase implementations
// (`db/firestore.ts`, `auth/firebase.ts`) — never from shared code — so the SDK
// stays out of the bundle when the app runs locally. Config values and the
// `isFirebaseConfigured()` switch live in `env.ts`.

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'

import { firebaseConfig } from './env'

let app: FirebaseApp | undefined
let firestore: Firestore | undefined

export function firebaseApp(): FirebaseApp {
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp())
}

export function firebaseDb(): Firestore {
  if (!firestore) {
    try {
      // The app's records use `undefined` for "not set" (cleared blockers, no
      // completedBy yet). Firestore rejects undefined unless told to drop it.
      firestore = initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true })
    } catch {
      firestore = getFirestore(firebaseApp())
    }
  }
  return firestore
}
