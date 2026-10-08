// The UK as of 8 Oct 2026 - the two Ads Manager exports Charles sent ("this is the
// accurate UK campaigns and adsets"). Supersedes the 7 Oct UK export. GENERATED from the
// workbooks, one entry per row, names verbatim from Meta - do not hand-edit; regenerate
// from new exports instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // UK - Untitled-report-Oct-8-2026.xlsx - 11 rows
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO NAC Shield', '10/08/26'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO Healvix', '10/08/26 swipes'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO VaricleX', '10/06/26 swipes'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO GumRevive', '10/04/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Revida', '10/04/26 swipes'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO Prostavita', '10/05/26'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', 'test'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO GumRevive', '10/06/26 Variations'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Revida', '10/08/26 swipes3'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/3/26 old winners'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/06/26'],

  // UK - Untitled-report-Oct-8-2026 (1).xlsx - 4 rows
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO FirmGlow', '10/06/26 swipes'],
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO EsoRepair', '10/06/26'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO Flowgut', '10/06/26 swipes'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO Flowgut', '10/08/26 swipes  2'],
]

export const UK_8_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
