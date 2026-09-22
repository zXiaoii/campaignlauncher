// Canada and the US as of 21 Sep 2026 - two of the four Ads Manager exports Charles
// sent ("this all of my adsets and campaigns each store"). The UK and AUS ones from
// that day are superseded by allStores22Sep.ts. GENERATED from the workbooks, one
// entry per row, names verbatim from Meta - do not hand-edit; regenerate from new
// exports instead. An empty ad-set name means the export was campaign level: the CBO
// comes in with the "ad sets not imported yet" placeholder.

import type { MetaExport } from '../importing'

const ROWS: [account: string, campaign: string, adset: string][] = [
  // CANADA - Untitled-report-Sep-21-2026 (2).xlsx - 45 rows
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 1 Bellavren'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 4 Prosta'],
  ['50677 Serenorth 4 [GO DGTL]', 'REL Beetamed 50677', '09/19/26 variation'],
  ['50676 Serenorth 3 [GO DGTL]', 'NEW CBO Bellavren', '09/19/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'SWE Ozempil', '09/19/26 swipes'],
  ['50677 Serenorth 4 [GO DGTL]', 'REL Steadyear RETARGET', '09/17/26 swipes'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'REL Flexivita', 'test 2 FlexiVita - Copy 2'],
  ['50676 Serenorth 3 [GO DGTL]', 'NEW Steadyear 50676', '09/19/26 swipes + playbook'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 2 Bellavren'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 1 Prosta'],
  ['50655 Serenorth [GO DGTL]', 'NEW CBO Ozempil TV Concept', '09/19/26 swipes'],
  ['50655 Serenorth [GO DGTL]', 'NEW CBO SteadyEar', '09/19/26 swipes'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 8 FlexiVita'],
  ['50677 Serenorth 4 [GO DGTL]', 'REL Esorepair 50677 #2', '09/17/26'],
  ['50676 Serenorth 3 [GO DGTL]', 'NEW META b12 50676', '09/19/26 swipes + playbook'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 2 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'CBO Bellavren', 'test 1  SWIPES'],
  ['50677 Serenorth 4 [GO DGTL]', 'NEW CBO Flowgut', '09/19/26 swipes'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'REL Flexivita', 'test 2 FlexiVita - Copy'],
  ['50677 Serenorth 4 [GO DGTL]', 'SWE Beetamed 50677', '09/19/26 curiosity'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 2 Prosta'],
  ['50677 Serenorth 4 [GO DGTL]', 'REL Beetamed 50677', '09/17/26 curiosity'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 7 Prosta'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 1 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 7 FlexiVita'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 3 Bellavren'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 8 Prosta'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 6 Prosta'],
  ['50677 Serenorth 4 [GO DGTL]', 'REL Esorepair 50677 #2', '09/19/26 swipes + playbook'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 6 Bellavren'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 5 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 1 FlexiVita'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 2 FlexiVita'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 4 Prosta'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 8 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 4 FlexiVita'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 5 Prosta'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 5 Bellavren'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 3 Prosta'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 3 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 5 FlexiVita'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'REL Prostavita Retarget', 'test 7 Prosta'],
  ['#8238 - CANADA | AD 4- Danny [ROAS A] 10210 - PP - RHKA', 'P00012 - Flexi Vita™ | €MAR 27,80 | BER 1,21 - Copy', 'test 3 FlexiVita'],
  ['#9570 - CANADA | AD 3 - Danny [ROAS A] 10172 - PP - RHKA', 'P00013 - Prosta Vita™ | MAR €24,84 | BER 1,21 - Copy', 'test 6 Prosta'],
  ['#4286 - CANADA | AD 1 - Danny [ROAS A] 10170 - PP - RHKA', 'P00041 - Bellavren™ Spray | MAR €19,52| BER 1,26 - Copy', 'Test 4 Bellavren'],

  // US - Untitled-report-Sep-21-2026.xlsx (campaign level: no ad-set names in the file) -  rows
  ['50662 Amermacy 2 [GO DGTL]', 'MAIN CBO VaricleX', ''],
]

export const ALL_STORES_21_SEP: MetaExport = {
  rows: ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(ROWS.map(([a]) => a))],
}
