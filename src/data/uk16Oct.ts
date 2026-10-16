// The UK as of 16 Oct 2026 - the two ad-set level Ads Manager exports Charles sent
// ("these are my UK campaigns and adsets"; a third, campaign-level file covered the
// same ADSOL / Reliore 8 campaigns and is not needed). Supersedes the 10 Oct UK
// exports. GENERATED from the workbooks, one entry per row, names verbatim from Meta -
// do not hand-edit; regenerate from new exports instead.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // UK - Untitled-report-Oct-16-2026.xlsx - 13 rows
  ['50752 Reliore 4 [GO DGTL]', 'CBO Aurica #2 CONCEPT', '10/15/26'],
  ['50752 Reliore 4 [GO DGTL]', 'MAIN CBO Aurica', '10/11/26 swipes'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO Slimora', '10/16/26 swipes'],
  ['50752 Reliore 4 [GO DGTL]', 'MAIN CBO HairRevive', '10/16/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', 'test'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO SomnaFlow', '10/11/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/3/26 old winners'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/08/26 new swpies'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'ABO COSTCAP Flexivita', 'C24'],
  ['50752 Reliore 4 [GO DGTL]', 'MAIN CBO SteadyEar', '10/13/26 swipes'],
  ['50752 Reliore 4 [GO DGTL]', 'MAIN CBO Aurica', '10/13/26 swipes 2'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/06/26'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'Fleixivita RELAUNCH OLD WINNERS', '10/09/26 new swpies'],

  // UK - Untitled-report-Oct-16-2026 (2).xlsx - 7 rows
  ['#10058 - UK | AD 34 - Danny - [ADSOL]', 'MAIN CBO Firmelle', '10/16/26 swipes'],
  ['#10058 - UK | AD 34 - Danny - [ADSOL]', 'MAIN CBO Pemiera', '10/15/26 relaunch'],
  ['#10058 - UK | AD 34 - Danny - [ADSOL]', 'MAIN CBO Loafguard', '10/16/26 swipes'],
  ['#10059 - UK | AD 34 - Danny - [ADSOL]', 'NEW CBO Flowgut', '10/16/26 relaunch'],
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO Primeface', '10/15/26 swipes'],
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO VesiCalm', '10/11/26 swipes - Copy'],
  ['50761 Reliore 8 [GO DGTL]', 'MAIN CBO VesiCalm', '10/11/26 swipes'],
]

export const UK_16_OCT: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
