// Canada as of 16 Oct 2026 - the ad-set level Ads Manager export Charles sent ("this
// is canada update this"). Supersedes the 10 Oct Canada exports. GENERATED from the
// workbook, one entry per row, names verbatim from Meta - do not hand-edit; regenerate
// from a new export instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // CANADA - Untitled-report-Oct-16-2026 (3).xlsx - 8 rows
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO VeinCare', '10/16/26 swipes'],
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO EsoRepair', '10/16/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/04/26 swipes'],
  ['50660 Serenorth [GO DGTL]', 'MAIN CBO FlowGut', '10/07/26 swipes'],
  ['#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'MAIN CBO - Bellavren', '10/7/26 pure swipes'],
  ['50676 Serenorth 3 [GO DGTL]', 'MAIN CBO NetuVera', '10/13/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/06/26 swipes - Copy'],
  ['50655 Serenorth [GO DGTL]', 'MAIN CBO BeetaMed', '10/06/26 swipes 3'],
]

export const CANADA_16_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
