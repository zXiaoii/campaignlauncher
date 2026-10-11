// Canada as of 10 Oct 2026 - the ad-set level Ads Manager export Charles sent after the
// campaign-level one ("do you see now"). Supersedes both the 7 Oct Canada export and
// the campaign-level 10 Oct one. GENERATED from the workbook, one entry per row, names
// verbatim from Meta - do not hand-edit; regenerate from a new export instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // CANADA - Untitled-report-Oct-10-2026 (3).xlsx - 13 rows
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/04/26 swipes'],
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO - Bellavren', '10/7/26 - Copy'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Arthyra', '10/10/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO SteadyEar', '10/06/26 swipes'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO FlowGut', '10/07/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO EasySpine', '10/08/26 swipes  2'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO Aveline', '10/09/26 swipes'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Hydrava', '10/10/26 swipes'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO Circuroll', '10/09/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO EasySpine', '10/04/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/06/26 swipes 3'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/06/26 swipes - Copy'],
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO - Bellavren', '10/7/26 pure swipes'],
]

export const CANADA_10_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
