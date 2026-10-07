// Canada as of 7 Oct 2026 - the Ads Manager export Charles sent ("this is for canada",
// "esorepair killed"). GENERATED from the workbook, one entry per row, names verbatim
// from Meta - do not hand-edit; regenerate from a new export instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // CANADA - Untitled-report-Oct-7-2026.xlsx - 7 rows
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO - Bellavren', '10/7/26 - Copy'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/04/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO EasySpine', '10/04/26 swipes'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'RELAUNCH prostavita', '10/05/26 old winners'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'NEW CBO EnergyGuard', '10/7/26 old winners relaunch'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/06/26 swipes - Copy'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO EsoRepair', '10/04/26 pure swipes'],
]

export const CANADA_7_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
