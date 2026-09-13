// Firestore implementation of the storage seam — same four functions as
// `local.ts`, same collection names (the PRD's table names), documents keyed by
// `id`. `persistChanges` diffs each changed collection against the previous
// state and writes only the documents that actually differ, in batches; every
// other client's `onSnapshot` then fires `onRemoteChange`, which is what makes
// the notification toasts cross-machine.

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

import { createSeedDb } from '../data/seed'
import { firebaseDb } from '../firebase/config'
import type { Db } from '../types'
import { normalizeOrder, STORES, type LoadResult } from './local'

// `db/index.ts` treats both implementations as `typeof import('./local')`; this
// module exports the same four names with the same signatures.

type CollectionKey = keyof typeof STORES
const COLLECTION_KEYS = Object.keys(STORES) as CollectionKey[]
const META = 'meta'
const BATCH_LIMIT = 450 // Firestore allows 500 ops per batch; leave headroom.

async function readAll(db: Firestore, key: CollectionKey): Promise<{ id: string }[]> {
  const snap = await getDocs(collection(db, STORES[key]))
  return snap.docs.map((d) => d.data() as { id: string })
}

async function writeCollection(
  db: Firestore,
  key: CollectionKey,
  rows: { id: string }[],
  removeIds: string[],
): Promise<void> {
  let batch = writeBatch(db)
  let count = 0
  const flush = async () => {
    if (count === 0) return
    await batch.commit()
    batch = writeBatch(db)
    count = 0
  }
  for (const row of rows) {
    batch.set(doc(db, STORES[key], row.id), row)
    count += 1
    if (count >= BATCH_LIMIT) await flush()
  }
  for (const id of removeIds) {
    batch.delete(doc(db, STORES[key], id))
    count += 1
    if (count >= BATCH_LIMIT) await flush()
  }
  await flush()
}

async function writeAll(db: Firestore, state: Db, keys: CollectionKey[]): Promise<void> {
  for (const key of keys) {
    const existing = await readAll(db, key)
    const keep = new Set((state[key] as { id: string }[]).map((r) => r.id))
    await writeCollection(
      db,
      key,
      state[key] as { id: string }[],
      existing.map((r) => r.id).filter((id) => !keep.has(id)),
    )
  }
}

export async function loadDatabase(): Promise<LoadResult> {
  const db = firebaseDb()
  const metaSnap = await getDocs(collection(db, META))
  const initialized = metaSnap.docs.some((d) => d.id === 'initialized')

  if (!initialized) {
    const seed = createSeedDb()
    await writeAll(db, seed, COLLECTION_KEYS)
    const batch = writeBatch(db)
    batch.set(doc(db, META, 'initialized'), { value: true, at: new Date().toISOString() })
    await batch.commit()
    return { db: seed, seeded: true }
  }

  const rows = await Promise.all(COLLECTION_KEYS.map((k) => readAll(db, k)))
  const out = {} as Db
  COLLECTION_KEYS.forEach((key, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(out as any)[key] = rows[i]
  })
  normalizeOrder(out)
  return { db: out, seeded: false }
}

/** Writes only the documents that changed inside the collections that changed. */
export async function persistChanges(previous: Db, next: Db): Promise<void> {
  const db = firebaseDb()
  for (const key of COLLECTION_KEYS) {
    if (previous[key] === next[key]) continue
    const before = new Map((previous[key] as { id: string }[]).map((r) => [r.id, r]))
    const after = next[key] as { id: string }[]
    const afterIds = new Set(after.map((r) => r.id))
    const changed = after.filter((r) => {
      const prev = before.get(r.id)
      return !prev || JSON.stringify(prev) !== JSON.stringify(r)
    })
    const removed = [...before.keys()].filter((id) => !afterIds.has(id))
    if (changed.length === 0 && removed.length === 0) continue
    await writeCollection(db, key, changed, removed)
  }
}

export async function resetDatabase(): Promise<Db> {
  const db = firebaseDb()
  const seed = createSeedDb()
  await writeAll(db, seed, COLLECTION_KEYS)
  const batch = writeBatch(db)
  batch.set(doc(db, META, 'initialized'), { value: true, at: new Date().toISOString() })
  await batch.commit()
  return seed
}

/**
 * Fires when any collection changes on the server. Skips each listener's
 * initial snapshot and this client's own pending writes, and coalesces a burst
 * of collection updates (one action touches several) into a single callback.
 */
export function onRemoteChange(callback: () => void): () => void {
  const db = firebaseDb()
  let timer: number | undefined
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(callback, 200)
  }
  const unsubs = COLLECTION_KEYS.map((key) => {
    let first = true
    return onSnapshot(collection(db, STORES[key]), { includeMetadataChanges: false }, (snap) => {
      if (first) {
        first = false
        return
      }
      if (snap.metadata.hasPendingWrites) return
      schedule()
    })
  })
  return () => {
    window.clearTimeout(timer)
    unsubs.forEach((u) => u())
  }
}
