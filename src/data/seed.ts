// The team's real book. AUSTRALIA as given by Charles on 20 Sep 2026 from Ads
// Manager; UK is complete from the Ads Manager export; CANADA and US are empty
// until their lists arrive.
//
// Campaigns are stored with their Meta names verbatim — the app only generates
// names for CBOs it creates. Each running campaign carries one placeholder ad set
// ("ad sets not imported yet") so the CBO reads as live and Next batch has something to model
// on; it has no launch date or history because none was given. Replace the
// placeholders with the real ad-set names when they come in.
//
// Killed campaigns (Heradem 4, DryControl, GUTFLUSH GO, Flexivita GO, Hairea,
// SomnaNu) are deliberately not seeded — Charles asked for them left out. Spend and
// results are not stored: the PRD rules metrics out.

import { at } from '../clock'
import { PLACEHOLDER_ADSET_NAME } from '../importing'
import { CONCEPT_LABELS, extractAdAccountNumber } from '../naming'
import type {
  AdAccount,
  Adset,
  Campaign,
  CampaignType,
  Country,
  Db,
  Product,
  User,
} from '../types'

// Rule: a user's id is always `u_` + username. The auth layer relies on it to map a
// sign-in back to a user without a lookup table, so new people follow it too.
export const USERS: User[] = [
  { id: 'u_charles', username: 'charles', name: 'Charles', role: 'MEDIA_BUYER', active: true, sortOrder: 1 },
  { id: 'u_danny', username: 'danny', name: 'Danny', role: 'CEO', active: true, sortOrder: 2 },
  { id: 'u_yzah', username: 'yzah', name: 'Yzah', role: 'CREATIVE', active: true, sortOrder: 3 },
  { id: 'u_karl', username: 'karl', name: 'Karl', role: 'SETUP', active: true, sortOrder: 4 },
  { id: 'u_christian', username: 'christian', name: 'Christian', role: 'SETUP', active: true, sortOrder: 5 },
  { id: 'u_mark', username: 'mark', name: 'Mark', role: 'SETUP_QA', active: true, sortOrder: 6 },
]

const COUNTRIES: Country[] = [
  { id: 'c_uk', code: 'UK', name: 'United Kingdom', sortOrder: 1 },
  { id: 'c_ca', code: 'CANADA', name: 'Canada', sortOrder: 2 },
  { id: 'c_au', code: 'AUSTRALIA', name: 'Australia', sortOrder: 3 },
  { id: 'c_us', code: 'US', name: 'United States', sortOrder: 4 },
]

function account(
  id: string,
  countryId: string,
  displayName: string,
  store: string | undefined,
  supplier: string | undefined,
  extra: Partial<Pick<AdAccount, 'supplierRef' | 'timezone' | 'status' | 'statusReason' | 'statusChangedAt'>> = {},
): AdAccount {
  return {
    id,
    countryId,
    displayName,
    adAccountNumber: extractAdAccountNumber(displayName),
    store,
    supplier,
    status: 'ACTIVE',
    ...extra,
  }
}

const TZ = {
  UK: 'Europe/London',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  US: 'America/New_York',
}

/** A GO DGTL account: display name verbatim, the supplier's "DGTL | XX | AD n" label kept. */
const dgtl = (num: string, name: string, country: 'UK' | 'CA' | 'AU' | 'US', ad: number, store: string) =>
  account(`ac_${num}`, `c_${country.toLowerCase()}`, `${num} ${name} [GO DGTL]`, store, 'GO DGTL', {
    supplierRef: `DGTL | ${country === 'AU' ? 'AUS' : country} | AD ${ad}`,
    timezone: TZ[country],
  })

// Suppliers so far: ADSC, RHKA (both "#nnnn - MARKET | AD n - Danny …" panels) and
// GO DGTL ("nnnnn store [GO DGTL]"). Balances from the panels are not stored.

type Market = 'UK' | 'CA' | 'AU' | 'US'
/** How each supplier panel spells the market inside an account name. */
const MARKET_LABEL: Record<Market, string> = { UK: 'UK', CA: 'CANADA', AU: 'AUS', US: 'US' }

/** An ADSC account — "#8517 - AUS | AD 10 - Danny - 6 - ADSC". `tail` is the exact suffix the panel shows. */
const adsc = (num: string, market: Market, ad: number, tail: string) =>
  account(
    `ac_${num}`,
    `c_${market.toLowerCase()}`,
    `#${num} - ${MARKET_LABEL[market]} | AD ${ad} - Danny${tail}`,
    undefined,
    'ADSC',
    { supplierRef: `ADSC | ${MARKET_LABEL[market]} | AD ${ad}`, timezone: TZ[market] },
  )

/**
 * An account Charles named only as "UK | AD n" — supplier and "#nnnn" number not
 * sent. The display name carries no number, so the directory flags it and campaign
 * naming into it is blocked until the number is corrected there. Used for the
 * off-boarded ones, where the number will never matter.
 */
const unnumbered = (
  market: Market,
  ad: number,
  extra: Partial<Pick<AdAccount, 'status' | 'statusReason' | 'statusChangedAt'>> = {},
) =>
  account(`ac_${market.toLowerCase()}_ad${ad}`, `c_${market.toLowerCase()}`, `${MARKET_LABEL[market]} | AD ${ad} - Danny`, undefined, undefined, {
    supplierRef: `${MARKET_LABEL[market]} | AD ${ad}`,
    timezone: TZ[market],
    ...extra,
  })

const OFFBOARDED_14_SEP = {
  status: 'OFFBOARDED' as const,
  statusReason: 'Off-boarded (Charles, 14 Sep 2026)',
  statusChangedAt: at(2026, 9, 14),
}

/** An RHKA account — "#2999 - AUS | AD 21 - Danny [ROAS A] 11391 - PP - RHKA". */
const rhka = (num: string, market: Market, ad: number, roas: string) =>
  account(
    `ac_${num}`,
    `c_${market.toLowerCase()}`,
    `#${num} - ${MARKET_LABEL[market]} | AD ${ad} - Danny [ROAS A] ${roas} - PP - RHKA`,
    undefined,
    'RHKA',
    { supplierRef: `RHKA | ${MARKET_LABEL[market]} | AD ${ad} · ROAS A ${roas}`, timezone: TZ[market] },
  )

/* Display names exactly as the supplier panels show them. */
const AD_ACCOUNTS: AdAccount[] = [
  /* ADSC — AUSTRALIA */
  adsc('8167', 'AU', 3, ' - ADSC'),
  adsc('8178', 'AU', 4, ' - ADSC'),
  adsc('8179', 'AU', 5, ' - ADSC'),
  adsc('8180', 'AU', 6, ' - ADSC'),
  adsc('8395', 'AU', 9, ' - ADSC'),
  adsc('8517', 'AU', 10, ' - 6 - ADSC'),
  adsc('8518', 'AU', 11, ' - 6 - ADSC'),
  adsc('8519', 'AU', 12, ' - 6 - ADSC'),
  adsc('8977', 'AU', 13, ' - 6 - ADSC'),
  adsc('8978', 'AU', 14, ' - 6 - ADSC'),
  adsc('8979', 'AU', 15, ' - 6 - ADSC'),

  /* ADSC — US */
  adsc('8514', 'US', 10, ' - 6 - ADSC'),
  adsc('8515', 'US', 11, ' - 6 - ADSC'),
  adsc('8516', 'US', 12, ' - 6 - ADSC'),
  adsc('8974', 'US', 13, ' - 6 - ADSC'),
  adsc('8975', 'US', 14, ' - 6 - ADSC'),
  adsc('8976', 'US', 15, ' - 6 - ADSC'),

  /* RHKA — AUSTRALIA */
  rhka('8973', 'AU', 16, '11245'),
  rhka('6713', 'AU', 17, '11277'),
  rhka('4405', 'AU', 18, '11342'),
  rhka('1123', 'AU', 19, '11389'),
  rhka('4454', 'AU', 20, '11389'),
  rhka('2999', 'AU', 21, '11391'),

  /* RHKA — US */
  rhka('5341', 'US', 17, '11244'),
  rhka('1683', 'US', 18, '11279'),
  rhka('1710', 'US', 19, '11384'),
  rhka('6324', 'US', 20, '11385'),
  rhka('9611', 'US', 21, '11386'),

  /* ADSC — UK (from the UK Ads Reporting pivot, 14 Sep 2026) */
  adsc('7965', 'UK', 16, ' - ADSC'),
  adsc('7966', 'UK', 17, ' - ADSC'),
  /* Off-boarded — named by Charles as "UK | AD n" only, supplier and number not sent. */
  unnumbered('UK', 13, OFFBOARDED_14_SEP),
  unnumbered('UK', 14, OFFBOARDED_14_SEP),
  unnumbered('UK', 15, OFFBOARDED_14_SEP),
  unnumbered('UK', 18, OFFBOARDED_14_SEP),

  /* RHKA — UK */
  rhka('2808', 'UK', 1, '8357'),
  rhka('9790', 'UK', 2, '8386'),
  rhka('6347', 'UK', 4, '8384'),
  rhka('3396', 'UK', 7, '9141'),
  rhka('2849', 'UK', 10, '9274'),
  rhka('1372', 'UK', 21, '11241'),
  rhka('2139', 'UK', 22, '11344'),
  rhka('7759', 'UK', 23, '11343'),
  rhka('8185', 'UK', 24, '11281'),

  /* RHKA — CANADA */
  rhka('6642', 'CA', 22, '11242'),
  rhka('6868', 'CA', 23, '11279'),
  rhka('8962', 'CA', 24, '11341'),

  /* GO DGTL — UK */
  dgtl('50643', 'reliore', 'UK', 1, 'Reliore'),
  dgtl('50656', 'Reliore', 'UK', 2, 'Reliore'),
  dgtl('50657', 'Reliore 2', 'UK', 3, 'Reliore'),

  /* GO DGTL — CANADA */
  dgtl('50655', 'Serenorth', 'CA', 1, 'Serenorth'),
  dgtl('50676', 'Serenorth 3', 'CA', 2, 'Serenorth'),
  dgtl('50660', 'Serenorth', 'CA', 4, 'Serenorth'),
  dgtl('50677', 'Serenorth 4', 'CA', 5, 'Serenorth'),

  /* GO DGTL — AUSTRALIA */
  dgtl('50647', 'aurmacy', 'AU', 1, 'Aurmacy'),
  dgtl('50674', 'Aurmacy 4', 'AU', 2, 'Aurmacy'),
  dgtl('50675', 'Aurmacy 5', 'AU', 3, 'Aurmacy'),
  dgtl('50659', 'Aurmacy', 'AU', 4, 'Aurmacy'),
  dgtl('50658', 'Aurmacy', 'AU', 5, 'Aurmacy'),

  /* GO DGTL — US */
  dgtl('50652', 'amermacy', 'US', 1, 'Amermacy'),
  dgtl('50661', 'Amermacy', 'US', 2, 'Amermacy'),
  dgtl('50662', 'Amermacy 2', 'US', 3, 'Amermacy'),
  dgtl('50663', 'Amermacy 3', 'US', 4, 'Amermacy'),
  dgtl('50664', 'Amermacy 4', 'US', 5, 'Amermacy'),
]

const PRODUCTS: Product[] = [
  { id: 'p_revida', name: 'Revida', active: true },
  { id: 'p_lidlift', name: 'Lidlift', active: true },
  { id: 'p_vitalith', name: 'Vitalith', active: true },
  { id: 'p_healvix', name: 'Healvix', active: true },
  { id: 'p_omegamax', name: 'OMEGAMAX', active: true },
  { id: 'p_dermalift', name: 'DermaLift', active: true },
  { id: 'p_lungpure', name: 'LungPure', active: true },
  { id: 'p_ozempil', name: 'Ozempil', active: true },
  { id: 'p_bellavren', name: 'Bellavren', active: true },
  /* Killed as a product; its UK CBO still runs on hold. Inactive so it is not offered for new CBOs. */
  { id: 'p_flexivita', name: 'Flexivita', active: false },
  { id: 'p_drycontrol', name: 'DryControl', active: true },
  { id: 'p_affinera', name: 'Affinera', active: true },
]

// ---------------------------------------------------------------------------
// Running campaigns and their live ad sets, as Ads Manager lists them.
//
// Ad-set names are verbatim (Meta's casing included). The launch date is the one
// in the name — that is the team's own convention (§4.4) — taken at noon because
// the time of day was not given; it only feeds the 48-hour helper. The concept
// label behind every one of them is the PRD default, so the next batch after
// `09/07/26 SWIPES` is `09/20/26 swipes + playbook`. A campaign whose ad sets
// have not been sent yet gets one "ad sets not imported yet" placeholder instead.

const campaigns: Campaign[] = []
const adsets: Adset[] = []

interface ExistingAdset {
  name: string
  /** [year, month, day] — the date in the ad-set name. Unset when the name has none. */
  launched?: [number, number, number]
  /** Framework, when the name says so ("iterations" → iteration). Default Swipes + Playbook. */
  concept?: 'SWIPES_PLAYBOOK' | 'ITERATION' | 'VARIATION' | 'CUSTOM'
}

function running(
  id: string,
  accountId: string,
  productId: string,
  name: string,
  type: CampaignType,
  existing: ExistingAdset[],
  opts: { onHold?: boolean } = {},
): void {
  campaigns.push({
    id,
    adAccountId: accountId,
    productId,
    name,
    campaignType: type,
    status: 'ACTIVE',
    onHold: opts.onHold || undefined,
    createdAt: at(2026, 9, 20),
  })
  if (existing.length === 0) {
    adsets.push({
      id: `${id}_existing`,
      campaignId: id,
      name: PLACEHOLDER_ADSET_NAME,
      conceptType: 'CUSTOM',
      conceptLabel: PLACEHOLDER_ADSET_NAME,
      status: 'ACTIVE',
    })
    return
  }
  existing.forEach((a, i) => {
    const concept = a.concept ?? 'SWIPES_PLAYBOOK'
    adsets.push({
      id: `${id}_${i + 1}`,
      campaignId: id,
      name: a.name,
      conceptType: concept,
      conceptLabel: concept === 'CUSTOM' ? a.name : CONCEPT_LABELS[concept],
      launchedAt: a.launched ? at(a.launched[0], a.launched[1], a.launched[2], 12, 0) : undefined,
      status: 'ACTIVE',
    })
  })
}

/* #8178 - AUS | AD 4 */
running('cm_revida_4', 'ac_8178', 'p_revida', 'MAIN CBO Revida 4', 'MAIN', [
  { name: '09/07/26 SWIPES', launched: [2026, 9, 7] },
  { name: '09/11/26 SWIPES 2', launched: [2026, 9, 11] },
])
running('cm_lidlift', 'ac_8178', 'p_lidlift', 'MAIN CBO Lidlift', 'MAIN', [
  { name: '09/07/26 SWIPES', launched: [2026, 9, 7] },
  { name: '09/12/26 SWIPES 2', launched: [2026, 9, 12] },
])
/* #8167 - AUS | AD 3 */
running('cm_vitalith_3', 'ac_8167', 'p_vitalith', 'MAIN CBO Vitalith 3', 'MAIN', [
  { name: '09/07/26', launched: [2026, 9, 7] },
  { name: '09/11/26 swipes 2', launched: [2026, 9, 11] },
])
/* #8179 - AUS | AD 5 */
running('cm_healvix', 'ac_8179', 'p_healvix', 'MAIN CBO Healvix', 'MAIN', [
  { name: '09/13/26 swipes', launched: [2026, 9, 13] },
])
/* #8977 - AUS | AD 13 */
running('cm_lidlift_13', 'ac_8977', 'p_lidlift', 'NEW CBO Lidlift 13', 'NEW', [
  { name: '09/12/26 iterations', launched: [2026, 9, 12], concept: 'ITERATION' },
])
/* #8395 - AUS | AD 9 — campaign name verbatim, "CBO MAIN" word order and all */
running('cm_dermalift', 'ac_8395', 'p_dermalift', 'CBO MAIN DermaLift', 'MAIN', [
  { name: '09/14/26 swipes', launched: [2026, 9, 14] },
])
/* #8519 - AUS | AD 12 */
running('cm_lungpure', 'ac_8519', 'p_lungpure', 'MAIN CBO LungPure', 'MAIN', [
  { name: '09/14/26 swipes', launched: [2026, 9, 14] },
])
/* Ad sets not sent yet — placeholder until they are. */
running('cm_omegamax_6', 'ac_8180', 'p_omegamax', 'MAIN CBO OMEGAMAX 6', 'MAIN', [
  { name: '09/10/26 SWIPES', launched: [2026, 9, 10] },
])

// ---- UK ------------------------------------------------------------------
// From Charles's Ads Manager export (Untitled-report.xlsx, ad-set level, "had
// delivery" on 13 Sep 2026): 29 ad sets in 15 CBOs on 9 accounts, every row
// carrying its account, so nothing here is inferred. Names are verbatim from
// Meta — including "NEW  CBO Ozempil 17" (two spaces), "09/11/2026 WIinner" and
// "test  2 iterations" — because they are copied back into Meta as-is.
//
// On hold (Charles: "we don't produce ad sets anymore" there): MAIN CBO
// Flexivita on AD 1, MAIN CBO Lidlift on AD 10 (#2849) and CBO Bellavren 4 on
// AD 4. They keep running in Meta; Next batch skips them. The "MAIN CBO Lidlift"
// on AD 7 (#3396) is a separate campaign and is not held.
//
// Framework per ad set: "swipes" → Swipes + Playbook, "iteration(s)" →
// Iteration, a bare date → Swipes + Playbook (the team default), anything else
// ("test n …", "batch concepts", "- Copy", "Old Winner") → Custom, label = name.

/* 50643 reliore [GO DGTL] */
running('cm_uk_ozempil_reliore', 'ac_50643', 'p_ozempil', 'NEW CBO Ozempil', 'NEW', [
  { name: '09/11/26 - Old Winner', launched: [2026, 9, 11], concept: 'CUSTOM' },
])
running('cm_uk_bellavren_reliore', 'ac_50643', 'p_bellavren', 'NEW CBO Bellavren', 'NEW', [
  { name: '09/11/26', launched: [2026, 9, 11] },
])
/* #7965 - UK | AD 16 - Danny - ADSC */
running('cm_uk_revida_16', 'ac_7965', 'p_revida', 'MAIN CBO Revida', 'MAIN', [
  { name: '08/24/26 batch swipes', launched: [2026, 8, 24] },
  { name: '08/21/26 batch concepts', launched: [2026, 8, 21], concept: 'CUSTOM' },
  { name: '08/26/26 batch Concept', launched: [2026, 8, 26], concept: 'CUSTOM' },
])
/* #2849 - UK | AD 10 - Danny [ROAS A] 9274 - PP - RHKA */
running(
  'cm_uk_lidlift_10',
  'ac_2849',
  'p_lidlift',
  'MAIN CBO Lidlift',
  'MAIN',
  [
    { name: 'test 8 LidLift™', concept: 'CUSTOM' },
    { name: 'test 6 LidLift™', concept: 'CUSTOM' },
    { name: 'test 10 LidLift™', concept: 'CUSTOM' },
  ],
  { onHold: true },
)
running('cm_uk_affinera_10', 'ac_2849', 'p_affinera', 'MAIN CBO Affinera 10', 'MAIN', [
  { name: '09/10/26 swipes', launched: [2026, 9, 10] },
])
/* #9790 - UK | AD 2 - Danny [ROAS A] 8386 - PP - RHKA */
running('cm_uk_revida_2', 'ac_9790', 'p_revida', 'NEW CBO Revida 2', 'NEW', [
  { name: '9/9/26 iteration', launched: [2026, 9, 9], concept: 'ITERATION' },
])
/* #3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA */
running('cm_uk_lidlift_7', 'ac_3396', 'p_lidlift', 'MAIN CBO Lidlift', 'MAIN', [
  { name: '09/08/26', launched: [2026, 9, 8] },
])
running('cm_uk_lidlift_7_new', 'ac_3396', 'p_lidlift', 'NEW CBO Lidlift 7', 'NEW', [
  { name: '08/09/26 - Copy', launched: [2026, 8, 9], concept: 'CUSTOM' },
])
/* #6347 - UK | AD 4 - Danny [ROAS A] 8384 - PP - RHKA */
running(
  'cm_uk_bellavren_4',
  'ac_6347',
  'p_bellavren',
  'CBO Bellavren 4',
  'MAIN',
  [
    { name: 'test 1 bellavren', concept: 'CUSTOM' },
    { name: 'test  2 iterations', concept: 'CUSTOM' },
  ],
  { onHold: true },
)
running('cm_uk_revida_4', 'ac_6347', 'p_revida', 'MAIN CBO Revida', 'MAIN', [
  { name: '09/08/26', launched: [2026, 9, 8] },
])
/* #2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA */
running(
  'cm_uk_flexivita_1',
  'ac_2808',
  'p_flexivita',
  'MAIN CBO Flexivita',
  'MAIN',
  [
    { name: 'test 20', concept: 'CUSTOM' },
    { name: 'test 36 - flexi', concept: 'CUSTOM' },
    { name: 'test 11', concept: 'CUSTOM' },
    { name: 'test 8 - flexivita', concept: 'CUSTOM' },
    { name: 'test 10 flexivita', concept: 'CUSTOM' },
    { name: 'test 9 flexivita', concept: 'CUSTOM' },
    { name: 'test 47 - flexivita', concept: 'CUSTOM' },
    { name: 'test 40 flexivita', concept: 'CUSTOM' },
    { name: 'test 6 flexivita', concept: 'CUSTOM' },
    { name: 'test 48 - Video UGC Ad', concept: 'CUSTOM' },
    { name: 'test 42 - flexivita', concept: 'CUSTOM' },
  ],
  { onHold: true },
)
/* #1372 - UK | AD 21 - Danny [ROAS A] 11241 - PP - RHKA */
running('cm_uk_revida_21', 'ac_1372', 'p_revida', 'MAIN CBO REVIDA 21', 'MAIN', [
  { name: '09/11/2026 WIinner', launched: [2026, 9, 11], concept: 'CUSTOM' },
])
/* #7966 - UK | AD 17 - Danny - ADSC */
running('cm_uk_drycontrol_17', 'ac_7966', 'p_drycontrol', 'MAIN CBO DryControl 17', 'MAIN', [
  { name: '08/30/26 swipes', launched: [2026, 8, 30] },
])
running('cm_uk_ozempil_17', 'ac_7966', 'p_ozempil', 'NEW  CBO Ozempil 17', 'NEW', [
  { name: '08/31/26 concepts', launched: [2026, 8, 31], concept: 'CUSTOM' },
])
running('cm_uk_revida_17', 'ac_7966', 'p_revida', 'NEW CBO REVIDA | 17', 'NEW', [
  { name: '08/27/26 swipes', launched: [2026, 8, 27] },
])

export function createSeedDb(): Db {
  return {
    users: USERS.map((u) => ({ ...u })),
    countries: COUNTRIES.map((c) => ({ ...c })),
    adAccounts: AD_ACCOUNTS.map((a) => ({ ...a })),
    products: PRODUCTS.map((p) => ({ ...p })),
    campaigns: campaigns.map((c) => ({ ...c })),
    adsets: adsets.map((a) => ({ ...a })),
    creativeBatches: [],
    launches: [],
    creativeTasks: [],
    setupTasks: [],
    followups: [],
    activityLogs: [],
  }
}
