// Prepared one-click jobs. Each bundles data Charles sent (a banned-accounts list,
// an Ads Manager export, or both) so that applying it on the live database is a
// single click on a banner instead of file handling. `MIGRATION_APPLY` in the store
// runs one: retire the banned accounts (if any), hold suppliers, import the book,
// then mark as killed whatever the job says is no longer running. Each applies
// once — the activity log records it — and nothing that went live is ever deleted.

import type { MetaExport, PastedAccount } from '../importing'
import { ALL_STORES_21_SEP } from './allStores21Sep'
import { BANNED_ACCOUNTS, RESTRICTION_WAVE_ID, RESTRICTION_WAVE_REASON } from './restrictionWave'

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
  /**
   * The book is the complete picture of these markets (country ids): every active
   * CBO there that is not in it is marked killed. CBO level only — ad sets are never
   * archived, because a one-day export lists what spent, not everything that exists.
   */
  matchCountryIds?: string[]
}

const NO_BOOK: MetaExport = { rows: [], columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' }, accounts: [] }

export const MIGRATIONS: PreparedMigration[] = [
  {
    // 16 Sep 2026: Meta banned 52 ad accounts. Retire-only now — the books it used
    // to import (UK 16 Sep, US #5341) are superseded by the all-stores job below.
    id: RESTRICTION_WAVE_ID,
    chip: 'Prepared clean-up · 16 Sep',
    title: 'Restriction wave',
    bookLabel: '',
    reason: RESTRICTION_WAVE_REASON,
    banned: BANNED_ACCOUNTS,
    book: NO_BOOK,
  },
  {
    // Charles, 19 Sep 2026: "ad accounts in RHKA put those on hold". A single
    // account is resumed from its card in Ad Accounts or its header in the Workspace.
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
    // Charles, 21 Sep 2026: four Ads Manager exports, one per store — "import them
    // all, kill what's already killed, so I can assign tasks easily". Every market is
    // made to match its file. Supersedes the Canada (18 Sep), AUS (19 Sep) and UK
    // (19 and 21 Sep) jobs; if any of those already ran, the match step cleans up
    // whatever they added that is no longer running.
    id: '2026-09-21-all-stores',
    chip: 'Prepared update · 21 Sep',
    title: 'All stores — match the 21 Sep exports',
    bookLabel: 'UK, Canada, AUS and US from your four 21 Sep exports',
    reason: '',
    banned: [],
    book: ALL_STORES_21_SEP,
    killWords: ['Snorestop', 'Curcuvera'],
    matchCountryIds: ['c_uk', 'c_ca', 'c_au', 'c_us'],
  },
]

export function findMigration(id: string): PreparedMigration | undefined {
  return MIGRATIONS.find((m) => m.id === id)
}
