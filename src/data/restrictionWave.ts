// The 16 Sep 2026 restriction wave, prepared as a one-click clean-up.
//
// Meta banned 52 ad accounts; everything was relaunched elsewhere. Charles sent
// the banned list from the supplier panel and the new UK book from Ads Manager.
// Both are embedded here, and `MIGRATION_APPLY` in the store turns them into the
// same two writes he would otherwise do by hand: Retire accounts, then Add
// existing CBO. Nothing that ever went live is deleted. Applies once — the
// activity log records it — and does nothing on a database where it already ran.

import type { MetaExport, PastedAccount } from '../importing'

export const RESTRICTION_WAVE_ID = '2026-09-16-restriction-wave'

export const RESTRICTION_WAVE_REASON = 'Banned by Meta on 16 Sep 2026 — relaunched on a new account'

/** The supplier panel, as pasted: display name + timezone. All "banned". */
export const BANNED_ACCOUNTS: PastedAccount[] = [
  { displayName: '#7023 - CANADA | AD 12 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#7024 - CANADA | AD 11 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8978 - AUS | AD 14 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8164 - US | AD 3 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#8196 - CANADA | AD 21 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8167 - AUS | AD 3 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8392 - US | AD 9 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#8168 - AUS | AD 2 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8199 - UK | AD 21 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#7852 - UK | AD 15 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8194 - CANADA | AD 19 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8393 - US | AD 8 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#7853 - UK | AD 14 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8169 - AUS | AD 1 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8178 - AUS | AD 4 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8517 - AUS | AD 10 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8514 - US | AD 10 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#8979 - AUS | AD 15 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8976 - US | AD 15 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#7970 - CANADA | AD 16 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#7859 - CANADA | AD 14 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8165 - US | AD 2 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#8166 - US | AD 1 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#7039 - CANADA | AD 10 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8181 - US | AD 4 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#8197 - UK | AD 19 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8198 - UK | AD 20 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8395 - AUS | AD 9 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#7858 - CANADA | AD 15 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#7966 - UK | AD 17 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8516 - US | AD 12 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#8977 - AUS | AD 13 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8518 - AUS | AD 11 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8975 - US | AD 14 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#8966 - UK | AD 8 - Danny [ROAS A] 9142 - PP - RHKA', timezone: 'Europe/London' },
  { displayName: '#8519 - AUS | AD 12 - Danny - 6 - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#7971 - CANADA | AD 17 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8397 - AUS | AD 7 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8182 - US | AD 5 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#7860 - CANADA | AD 13 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#7854 - UK | AD 13 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#7965 - UK | AD 16 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#7967 - UK | AD 18 - Danny - ADSC', timezone: 'Europe/London' },
  { displayName: '#8179 - AUS | AD 5 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8180 - AUS | AD 6 - Danny - ADSC', timezone: 'Australia/Sydney' },
  { displayName: '#8183 - US | AD 6 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#7972 - CANADA | AD 18 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8394 - US | AD 7 - Danny - ADSC', timezone: 'America/New_York' },
  { displayName: '#8195 - CANADA | AD 20 - Danny - ADSC', timezone: 'America/Toronto' },
  { displayName: '#8515 - US | AD 11 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#8974 - US | AD 13 - Danny - 6 - ADSC', timezone: 'America/New_York' },
  { displayName: '#8396 - AUS | AD 8 - Danny - ADSC', timezone: 'Australia/Sydney' },
]

/** The new UK book — Ads Manager export "Untitled-report (1).csv", 16 Sep 2026, 19 rows. */
const UK_ROWS: [account: string, campaign: string, adset: string][] = [
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/16/26 iteration'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/16/26 swipes'],
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/16/26 swipes'],
  ['50643 reliore [GO DGTL]', 'NEW CBO FlexiSion', '09/14/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 20'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'MAIN CBO Lidlift', '09/08/26'],
  ['#2849 - UK | AD 10 - Danny [ROAS A] 9274 - PP - RHKA', 'MAIN CBO Lidlift', 'test 8 LidLift™'],
  ['#7759 - UK | AD 23 - Danny [ROAS A] 11343 - PP - RHKA', 'MAIN CBO ENERGYSAVE', '09/14/26 Swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 11'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 36 - flexi'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'NEW CBO Lidlift 7', '08/09/26 - Copy'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO AFFINERA GODGTL', '09/14/26 Swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 8 - flexivita'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO AFFINERA GODGTL', '09/16/26 iteration'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'MAIN CBO Lidlift', '09/15/26 pure swipes'],
  ['#2849 - UK | AD 10 - Danny [ROAS A] 9274 - PP - RHKA', 'MAIN CBO Lidlift', 'test 6 LidLift™'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/15/26 iteration'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 40 flexivita'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 42 - flexivita'],
]

/** The US book — Ads Reporting pivot for #5341, 16 Sep 2026, campaign and ad-set rows nested. */
const US_ROWS: [account: string, campaign: string, adset: string][] = [
  ['#5341 - US | AD 17 - Danny [ROAS A] 11244 - PP - RHKA', 'MAIN CBO Lungero', '09/10/26 swipes'],
  ['#5341 - US | AD 17 - Danny [ROAS A] 11244 - PP - RHKA', 'MAIN CBO Lungero', '09/15/26 swipes'],
  ['#5341 - US | AD 17 - Danny [ROAS A] 11244 - PP - RHKA', 'MAIN CBO Milk Thistle Liver Detox', '09/15/26 swipes'],
  ['#5341 - US | AD 17 - Danny [ROAS A] 11244 - PP - RHKA', 'MAIN CBO VitaSlim', '09/15/26 swipes'],
]

const ALL_ROWS = [...UK_ROWS, ...US_ROWS]

/** Everything the clean-up imports, as one export: the new UK book plus the US book. */
export const NEW_UK_EXPORT: MetaExport = {
  rows: ALL_ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ALL_ROWS.map(([a]) => a))],
}
