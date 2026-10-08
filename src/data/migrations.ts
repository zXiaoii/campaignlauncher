// Prepared one-click jobs. Each bundles data Charles sent (a banned-accounts list,
// an Ads Manager export, or both) so that applying it on the live database is a
// single click on a banner instead of file handling. `MIGRATION_APPLY` in the store
// runs one: retire the banned accounts (if any), hold suppliers, import the book,
// then mark as killed whatever the job says is no longer running. Each applies
// once — the activity log records it — and nothing that went live is ever deleted.

import type { MetaExport, PastedAccount } from '../importing'
import { ALL_STORES_21_SEP } from './allStores21Sep'
import { ACCOUNTS_7_OCT, ACCOUNTS_7_OCT_SUPPLIERS, type AccountSpec } from './accounts7Oct'
import { ALL_STORES_22_SEP } from './allStores22Sep'
import { CANADA_7_OCT } from './canada7Oct'
import { UK_8_OCT } from './uk8Oct'
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
  /**
   * Clean slate: every active CBO in every market is marked killed (history kept,
   * revivable). A launch still in flight is cancelled first — its planned ad set and
   * both tasks go — so the CBO can be killed too.
   */
  killAll?: boolean
  /** Take every held ad account off hold. */
  resumeAll?: boolean
  /**
   * Product per campaign name, for names the reader cannot work out on its own
   * ("Fleixivita RELAUNCH OLD WINNERS" → Flexivita). Case- and space-insensitive.
   */
  products?: Record<string, string>
  /** Ad accounts from the supplier panels: created when the directory lacks them. */
  accounts?: AccountSpec[]
  /**
   * The panels are the whole truth for these suppliers: an account of theirs in the
   * directory that no spec names is retired (off-boarded, its CBOs killed).
   */
  matchSuppliers?: string[]
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
    // all, kill what's already killed, so I can assign tasks easily". Each market is
    // made to match its file. Supersedes the Canada (18 Sep), AUS (19 Sep) and UK
    // (19 and 21 Sep) jobs; if any of those already ran, the match step cleans up
    // whatever they added that is no longer running. The UK and AUS halves moved to
    // the 22 Sep job below when newer exports arrived, so the two jobs never
    // disagree about a market whichever is applied first.
    id: '2026-09-21-all-stores',
    chip: 'Prepared update · 21 Sep',
    title: 'Canada & US — match the 21 Sep exports',
    bookLabel: 'Canada and US from your 21 Sep exports',
    reason: '',
    banned: [],
    book: ALL_STORES_21_SEP,
    killWords: ['Snorestop', 'Curcuvera'],
    matchCountryIds: ['c_ca', 'c_us'],
  },
  {
    // Charles, 22 Sep 2026: "i will give now all the campaigns and adsets of our
    // stores" — UK ("update them all") and AUS so far. Markets are added here as
    // their exports arrive; a market not listed is left to the 21 Sep job.
    id: '2026-09-22-all-stores',
    chip: 'Prepared update · 22 Sep',
    title: 'UK & AUS — match the 22 Sep exports',
    bookLabel: 'UK and AUS from your 22 Sep exports',
    reason: '',
    banned: [],
    book: ALL_STORES_22_SEP,
    matchCountryIds: ['c_uk', 'c_au'],
  },
  {
    // Charles, 7 Oct 2026: "reset all of my campaigns" — chosen as mark-all-killed so
    // nothing is deleted and Danny's history stays; "also the inflight cbo, also put
    // the onhold ad accounts into resume". Fresh exports follow as a new import job;
    // what is running comes back as new CBOs.
    id: '2026-10-07-kill-all',
    chip: 'Prepared reset · 7 Oct',
    title: 'Clean slate — mark every CBO killed',
    bookLabel: '',
    reason: '',
    banned: [],
    book: NO_BOOK,
    killAll: true,
    resumeAll: true,
  },
  {
    // Charles, 7 Oct 2026: both supplier panels pasted, active accounts only —
    // "these are the ad accounts we have right now". The directory is made to match:
    // missing accounts are added with their market, supplier label and timezone;
    // GO DGTL / RHKA accounts no longer on a panel are retired.
    id: '2026-10-07-ad-accounts',
    chip: 'Prepared update · 7 Oct',
    title: 'Ad accounts — match the 7 Oct panels',
    bookLabel: '',
    reason: 'Not on the supplier panel on 7 Oct 2026',
    banned: [],
    book: NO_BOOK,
    accounts: ACCOUNTS_7_OCT,
    // GO DGTL only: the ROAS panel paste turned out to be partial (the 7 Oct Canada
    // export still runs on #4286 and #9570, which it did not list), so RHKA / ADSOL
    // accounts are added but never retired by this job.
    matchSuppliers: ACCOUNTS_7_OCT_SUPPLIERS,
  },
  {
    // Charles, 7 Oct 2026: the Canada export after the clean slate — "this is for
    // canada", "esorepair killed". Canada is made to match it; EsoRepair comes in
    // and is marked killed in the same click, so the record shows it ran and stopped.
    id: '2026-10-07-canada',
    chip: 'Prepared update · 7 Oct',
    title: 'Canada — match the 7 Oct export',
    bookLabel: 'Canada from your 7 Oct export',
    reason: '',
    banned: [],
    book: CANADA_7_OCT,
    killWords: ['Esorepair'],
    matchCountryIds: ['c_ca'],
  },
  {
    // Charles, 8 Oct 2026: two UK exports, "the accurate UK campaigns and adsets …
    // leave the already good ones untouched, Variclex is killed". Replaces the 7 Oct
    // UK job (same id would have been applied already where it ran; where it had not,
    // this one covers everything it had that is still running). The misspelt
    // "Fleixivita" CBO is Flexivita.
    id: '2026-10-08-uk',
    chip: 'Prepared update · 8 Oct',
    title: 'UK — match the 8 Oct exports',
    bookLabel: 'UK from your two 8 Oct exports',
    reason: '',
    banned: [],
    book: UK_8_OCT,
    killWords: ['Variclex'],
    matchCountryIds: ['c_uk'],
    products: { 'Fleixivita RELAUNCH OLD WINNERS': 'Flexivita' },
  },
]

export function findMigration(id: string): PreparedMigration | undefined {
  return MIGRATIONS.find((m) => m.id === id)
}
