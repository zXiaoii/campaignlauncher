// The storage seam. Everything above this line imports from here and never
// learns whether it is talking to IndexedDB or Firestore. The implementation is
// loaded dynamically so the Firebase SDK is only downloaded when it is in use.

import { isFirebaseConfigured } from '../firebase/env'
import type { Db } from '../types'
import type { LoadResult } from './local'

/** The contract both `local.ts` and `firestore.ts` fulfil. */
interface Impl {
  loadDatabase: () => Promise<LoadResult>
  persistChanges: (previous: Db, next: Db) => Promise<void>
  resetDatabase: () => Promise<Db>
  onRemoteChange: (callback: () => void) => () => void
}

let implPromise: Promise<Impl> | undefined
function impl(): Promise<Impl> {
  if (!implPromise) {
    implPromise = isFirebaseConfigured() ? import('./firestore') : import('./local')
  }
  return implPromise
}

export const loadDatabase = (): Promise<LoadResult> => impl().then((m) => m.loadDatabase())

export const persistChanges = (previous: Db, next: Db): Promise<void> =>
  impl().then((m) => m.persistChanges(previous, next))

export const resetDatabase = (): Promise<Db> => impl().then((m) => m.resetDatabase())

export function onRemoteChange(callback: () => void): () => void {
  let unsubscribe: (() => void) | undefined
  let cancelled = false
  void impl().then((m) => {
    if (cancelled) return
    unsubscribe = m.onRemoteChange(callback)
  })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export type { LoadResult } from './local'
