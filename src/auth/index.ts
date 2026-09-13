// The auth seam. Same four functions from either implementation; the store
// never learns which one answered. Loaded dynamically so Firebase Auth is only
// downloaded when Firebase is configured.

import { isFirebaseConfigured } from '../firebase/env'

interface AuthImpl {
  verify: (username: string, password: string) => Promise<string | null>
  getSession: () => Promise<string | null>
  saveSession: (userId: string) => Promise<void>
  clearSession: () => Promise<void>
}

let implPromise: Promise<AuthImpl> | undefined
function impl(): Promise<AuthImpl> {
  if (!implPromise) {
    implPromise = isFirebaseConfigured()
      ? import('./firebase')
      : import('./session').then((m) => ({
          verify: m.verify,
          getSession: async () => m.loadSession(),
          saveSession: async (userId: string) => m.saveSession(userId),
          clearSession: async () => m.clearSession(),
        }))
  }
  return implPromise
}

export const verify = (username: string, password: string) =>
  impl().then((m) => m.verify(username, password))
export const getSession = () => impl().then((m) => m.getSession())
export const saveSession = (userId: string) => impl().then((m) => m.saveSession(userId))
export const clearSession = () => impl().then((m) => m.clearSession())
