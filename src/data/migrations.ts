// Prepared one-click jobs. Each bundles data Charles sent (a banned-accounts list,
// an Ads Manager export, or both) so that applying it on the live database is a
// single click on a banner instead of file handling. `MIGRATION_APPLY` in the store
// runs one: retire the banned accounts (if any), then import the book. Each applies
// once — the activity log records it — and only ever adds or retires, never deletes
// anything that went live.

import type { MetaExport, PastedAccount } from '../importing'
import { AUS_EXPORT } from './ausImport'
import { CANADA_EXPORT } from './canadaImport'
import { BANNED_ACCOUNTS, NEW_UK_EXPORT, RESTRICTION_WAVE_ID, RESTRICTION_WAVE_REASON } from './restrictionWave'
import { UK2_EXPORT } from './ukImport'

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
  /** Suppliers whose every account in play goes on hold (nothing new launched into them). */
  holdSuppliers?: string[]
  /**
   * Products Charles declared killed: every active CBO whose name or product
   * contains one of these words is marked killed (history kept, revivable).
   */
  killWords?: string[]
}

const NO_BOOK: MetaExport = { rows: [], columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' }, accounts: [] }

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
  {
    // Charles, 19 Sep 2026: "ad accounts in RHKA put those on hold". Accounts the
    // Canada import creates afterwards inherit the hold, so the order of the two
    // clicks does not matter.
    id: '2026-09-19-rhka-hold',
    chip: 'Prepared change · 19 Sep',
    title: 'RHKA on hold',
    bookLabel: '',
    reason: '',
    banned: [],
    book: NO_BOOK,
    holdSuppliers: ['RHKA'],
  },
  {
    // Charles, 19 Sep 2026: the AUS GO DGTL book, and "snorestop and curcuvera is killed".
    id: '2026-09-19-aus-book',
    chip: 'Prepared import · 19 Sep',
    title: 'AUS book',
    bookLabel: 'the AUS GO DGTL book from your pivots',
    reason: '',
    banned: [],
    book: AUS_EXPORT,
    killWords: ['Snorestop', 'Curcuvera'],
  },
  {
    id: '2026-09-19-uk-book',
    chip: 'Prepared import · 19 Sep',
    title: 'UK update',
    bookLabel: 'the UK GO DGTL and AD 23 updates from your 18–19 Sep pivots',
    reason: '',
    banned: [],
    book: UK2_EXPORT,
  },
]

export function findMigration(id: string): PreparedMigration | undefined {
  return MIGRATIONS.find((m) => m.id === id)
}
