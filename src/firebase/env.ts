// Firebase configuration — the part that is safe to import anywhere. No SDK
// imports here, so a build without Firebase config never bundles Firebase; the
// SDK lives behind `config.ts`, which is only pulled in dynamically when
// `isFirebaseConfigured()` is true.

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
}

/** Human label for the sign-in card, so the team can see which backend they are on. */
export function backendLabel(): string {
  return isFirebaseConfigured()
    ? `Firebase · ${firebaseConfig.projectId}`
    : 'Local database (this browser only)'
}
