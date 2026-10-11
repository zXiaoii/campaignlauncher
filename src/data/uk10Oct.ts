// The UK as of 10 Oct 2026 - the two Ads Manager exports Charles sent ("this is all for
// the UK"). The second is campaign level: its CBOs new to the app arrive with the
// placeholder ad set. Supersedes the 8 Oct UK exports. GENERATED from the workbooks,
// one entry per row, names verbatim from Meta - do not hand-edit; regenerate instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // UK - Untitled-report-Oct-10-2026 (4).xlsx - 6 rows
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO WormWood', '10/10/26 swipes'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO FlowEase', '10/10/26 swipes'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO Flowgut', '10/06/26 swipes'],
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO Kortivi', '10/09/26'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO Cellux', '10/09/26 swipes'],
  ['50760 Reliore 7 [GO DGTL]', 'MAIN CBO Flowgut', '10/08/26 swipes  2'],

  // UK - Untitled-report-Oct-10-2026 (5).xlsx (campaign level) - 9 rows
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', ''],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO Prostavita', ''],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Revida', ''],
  ['50752 Reliore 4 [GO DGTL]', 'MAIN CBO Retiova', ''],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO Hydroflux', ''],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO GumRevive', ''],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO NAC Shield', ''],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO Healvix', ''],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'COSTCAP Flexivita', ''],
]

export const UK_10_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
