// Local database — IndexedDB, no server.
//
// One object store per table in PRD §14, keyed by `id`, using the spec's snake_case
// table names so the browser's Application tab reads like the data model document.
// Nothing leaves the machine.
//
// Persistence strategy: the reducer in `store.tsx` only allocates a new array for
// the collections a given action actually touched, so `persistChanges` can compare
// array identity against the previous state and rewrite just those stores. That
// keeps writes proportional to the edit rather than to the size of the database.
//
// This module is the seam. Swapping IndexedDB for a real API later means
// reimplementing `loadDatabase` / `persistChanges` / `clearDatabase` and nothing else.

import { createSeedDb } from '../data/seed'
import type { Db } from '../types'

const DB_NAME = 'launchdesk'
/** Bump when the shape of stored rows changes; an upgrade forces a reseed. */
const DB_VERSION = 12
const META_STORE = 'meta'

/** Db field → IndexedDB store name (the PRD's table names). */
export const STORES = {
  users: 'users',
  countries: 'countries',
  adAccounts: 'ad_accounts',
  products: 'products',
  campaigns: 'campaigns',
  adsets: 'adsets',
  creativeBatches: 'creative_batches',
  launches: 'launches',
  creativeTasks: 'creative_tasks',
  setupTasks: 'setup_tasks',
  followups: 'followups',
  activityLogs: 'activity_logs',
} as const

type CollectionKey = keyof typeof STORES
const COLLECTION_KEYS = Object.keys(STORES) as CollectionKey[]

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let connection: IDBDatabase | null = null

function open(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
      // Upgrading an existing database: drop the `initialized` flag so
      // loadDatabase() rewrites the seed in the current row shape. Acceptable
      // because this is prototype data; a production migration would rewrite rows
      // in place instead of discarding them.
      if (event.oldVersion > 0) {
        request.transaction?.objectStore(META_STORE).clear()
      }
    }

    request.onsuccess = () => {
      connection = request.result
      // Another tab upgraded the schema — drop this stale handle rather than
      // blocking its transaction.
      connection.onversionchange = () => {
        connection?.close()
        connection = null
      }
      resolve(connection)
    }
    request.onerror = () => reject(request.error)
  })
}

async function readMeta<T>(key: string): Promise<T | undefined> {
  const db = await open()
  const tx = db.transaction(META_STORE, 'readonly')
  const row = await promisify<{ key: string; value: T } | undefined>(
    tx.objectStore(META_STORE).get(key),
  )
  return row?.value
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await open()
  const tx = db.transaction(META_STORE, 'readwrite')
  tx.objectStore(META_STORE).put({ key, value })
  await done(tx)
}

async function writeAll(db: IDBDatabase, state: Db, keys: CollectionKey[]): Promise<void> {
  const storeNames = keys.map((k) => STORES[k])
  const tx = db.transaction(storeNames, 'readwrite')
  for (const key of keys) {
    const store = tx.objectStore(STORES[key])
    store.clear()
    for (const row of state[key] as { id: string }[]) store.put(row)
  }
  await done(tx)
}

export interface LoadResult {
  db: Db
  currentUserId?: string
  /** True when this was a cold start and the seed had to be written. */
  seeded: boolean
}

/**
 * Reads the whole database into memory. On a cold start, writes the seed first so
 * the prototype always opens on a populated day.
 */
export async function loadDatabase(): Promise<LoadResult> {
  const conn = await open()
  const initialized = await readMeta<boolean>('initialized')

  if (!initialized) {
    const seed = createSeedDb()
    await writeAll(conn, seed, COLLECTION_KEYS)
    await writeMeta('initialized', true)
    await writeMeta('seededAt', new Date().toISOString())
    return { db: seed, seeded: true }
  }

  const tx = conn.transaction(
    COLLECTION_KEYS.map((k) => STORES[k]),
    'readonly',
  )
  const rows = await Promise.all(
    COLLECTION_KEYS.map((k) => promisify(tx.objectStore(STORES[k]).getAll())),
  )
  const db = {} as Db
  COLLECTION_KEYS.forEach((key, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any)[key] = rows[i]
  })
  normalizeOrder(db)

  const currentUserId = await readMeta<string>('currentUserId')
  return { db, currentUserId, seeded: false }
}

/**
 * `getAll()` hands rows back in key order, not insertion order, so anything whose
 * display order is meaningful is re-sorted once here rather than in every consumer.
 * Collections the selectors already sort (campaigns, ad sets, tasks) are left alone.
 */
export function normalizeOrder(db: Db): void {
  db.countries.sort((a, b) => a.sortOrder - b.sortOrder)
  db.users.sort((a, b) => a.sortOrder - b.sortOrder)
  db.products.sort((a, b) => a.name.localeCompare(b.name))
  db.adAccounts.sort((a, b) => a.adAccountNumber.localeCompare(b.adAccountNumber))
  db.activityLogs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}

/** Rewrites only the collections whose array identity changed. */
export async function persistChanges(previous: Db, next: Db): Promise<void> {
  const changed = COLLECTION_KEYS.filter((key) => previous[key] !== next[key])
  if (changed.length === 0) return
  const conn = await open()
  await writeAll(conn, next, changed)
  // Tell every other tab on this machine the database moved. This is the local
  // stand-in for a realtime backend: with Firestore, `onSnapshot` fires the same
  // callback that `onRemoteChange` does here.
  channel?.postMessage({ type: 'changed', collections: changed, at: Date.now() })
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB_NAME) : null

/**
 * Subscribe to changes made by other tabs. The posting tab never receives its
 * own message, so a subscriber can reload without looping. Returns unsubscribe.
 */
export function onRemoteChange(callback: () => void): () => void {
  if (!channel) return () => {}
  const handler = () => callback()
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}

/** Wipes every store and rewrites the seed — the "Reset data" action. */
export async function resetDatabase(): Promise<Db> {
  const conn = await open()
  const seed = createSeedDb()
  await writeAll(conn, seed, COLLECTION_KEYS)
  await writeMeta('initialized', true)
  await writeMeta('seededAt', new Date().toISOString())
  return seed
}

/** Deletes the database entirely. Exposed for debugging from the console. */
export async function clearDatabase(): Promise<void> {
  connection?.close()
  connection = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}
