// Canada as of 10 Oct 2026 - the Ads Manager export Charles sent ("edit the whole
// campaigns and adset for canada into this"). Campaign level: the file has no ad-set
// column, so a CBO new to the app arrives with the "ad sets not imported yet"
// placeholder. Supersedes the 7 Oct Canada export. GENERATED from the workbook, one
// entry per row, names verbatim from Meta - do not hand-edit; regenerate instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // CANADA - Untitled-report-Oct-10-2026 (1).xlsx (campaign level) - 9 rows
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', ''],
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO - Bellavren', ''],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Arthyra', ''],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO SteadyEar', ''],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO EasySpine', ''],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO FlowGut', ''],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO Aveline', ''],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Hydrava', ''],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Circuroll', ''],
]

export const CANADA_10_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
