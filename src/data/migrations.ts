// Prepared one-click jobs. Each bundles data Charles sent (a banned-accounts list,
// an Ads Manager export, or both) so that applying it on the live database is a
// single click on a banner instead of file handling. `MIGRATION_APPLY` in the store
// runs one: retire the banned accounts (if any), then import the book. Each applies
// once — the activity log records it — and only ever adds or retires, never deletes
// anything that went live.

import type { MetaExport, PastedAccount } from '../importing'
import { CANADA_EXPORT } from './canadaImport'
import { BANNED_ACCOUNTS, NEW_UK_EXPORT, RESTRICTION_WAVE_ID, RESTRICTION_WAVE_REASON } from './restrictionWave'

export interface PreparedMigration {
  id: string
  /** Short tag on the banner. */
  chip: string
  /** What it is, in two or three words. */
  title: string
  /** What the import half brings in, for the banner sentence. */
  bookLabel: string
  /** Written on every retired account. Unused when `banned` is empty. */
  reason: string
  banned: PastedAccount[]
  book: MetaExport
}

export const MIGRATIONS: PreparedMigration[] = [
  {
    id: RESTRICTION_WAVE_ID,
    chip: 'Prepared clean-up · 16 Sep',
    title: 'Restriction wave',
    bookLabel: 'the new UK and US book',
    reason: RESTRICTION_WAVE_REASON,
    banned: BANNED_ACCOUNTS,
    book: NEW_UK_EXPORT,
  },
  {
    id: '2026-09-18-canada-book',
    chip: 'Prepared import · 18 Sep',
    title: 'Canada book',
    bookLabel: 'the Canada book from your 18 Sep export',
    reason: '',
    banned: [],
    book: CANADA_EXPORT,
  },
]

export function findMigration(id: string): PreparedMigration | undefined {
  return MIGRATIONS.find((m) => m.id === id)
}
