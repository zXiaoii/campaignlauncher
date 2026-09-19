// UK GO DGTL + AD 23 book — from the Ads Reporting pivot pastes of 18 and 19 Sep 2026,
// on top of the 16 Sep export already in restrictionWave.ts. The import only adds what
// is missing, so rows that the earlier job already brought in are simply recognised.
// Placed by spend totals:
//   50643 reliore  15.71 = REL Revida 8.20 + REL Bellavren 3.92 + DIR Ozempil 3.59
//   50656 Reliore  14.42 = SWE Bellavren 6.00 + AFFINERA GODGTL 0.82 + SWE Revida 4.67
//                          + DIR Ozempil 19 2.55 + DIR OZEMPIL COSTCAP 0.38          (18 Sep)
//   DIR Ozempil 19 18.71 = 9.96 + 8.65 + 0.10;  REL AFFINERA RETARGET 7.22 = 7.22   (19 Sep)
// DIR OZEMPIL COSTCAP is a cost-cap CBO: the trigger never touches it.
// #7759 AD 23 had about one euro on a campaign that never appeared in a paste.

import type { MetaExport } from '../importing'

const UK2_ROWS: [account: string, campaign: string, adset: string][] = [
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/16/26 swipes'],
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/16/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/17/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/16/26 swipes'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/16/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/17/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/16/26 iteration'],
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/16/26 swipes + playbook'],
  // 19 Sep paste: DIR Ozempil 9.29 = 8.53 + 0.73 + 0.03
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/17/26 swipes + playbook'],

  ['50656 Reliore [GO DGTL]', 'SWE Bellavren', '09/15/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO AFFINERA GODGTL', '09/14/26 Swipes'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO AFFINERA GODGTL', '09/16/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO AFFINERA GODGTL', '09/17/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'SWE Revida', '09/17/26 curiosity'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/15/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/16/26 swipes + playbook'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/17/26 swipes + playbook'],
  ['50656 Reliore [GO DGTL]', 'DIR OZEMPIL COSTCAP', '09/15/26 iteration - Copy'],
  ['50656 Reliore [GO DGTL]', 'REL AFFINERA RETARGET', '09/19/26 iteration'],

  ['#7759 - UK | AD 23 - Danny [ROAS A] 11343 - PP - RHKA', 'MAIN CBO FreshGaze 23', '09/17/26 Swipes'],
]

export const UK2_EXPORT: MetaExport = {
  rows: UK2_ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(UK2_ROWS.map(([a]) => a))],
}
