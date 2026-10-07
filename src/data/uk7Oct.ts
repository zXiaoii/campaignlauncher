// The UK as of 7 Oct 2026 - the Ads Manager export Charles sent after the clean slate.
// GENERATED from the workbook, one entry per row, names verbatim from Meta - do not
// hand-edit; regenerate from a new export instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // UK - Untitled-report-Oct-7-2026 (1).xlsx - 11 rows
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Revida', '10/04/26 swipes'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO Prostavita', '10/05/26'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', 'test'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO VaricleX', '10/06/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/3/26 old winners'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO GumRevive', '10/04/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/06/26'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO GumRevive', '10/06/26 Variations'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO MetaB12', '10/05/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'COSTCAP Flexivita', 'C7'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Revida', '10/04/26 swipes 2'],
]

export const UK_7_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
