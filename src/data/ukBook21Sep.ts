// The UK book as of 21 Sep 2026 — Ads Manager export "Untitled-report (3).csv".
// GENERATED from the CSV (one entry per row, names verbatim from Meta) — do not
// hand-edit; regenerate from a new export instead. The file is a one-day "had
// delivery" export, so it lists what ran that day; the job that uses it makes UK
// match it at the CBO level and never archives individual ad sets.
// Note: REL Bellavren has two ad sets both named "09/17/26 swipes + playbook" in
// Meta; the app keeps ad-set names unique per CBO, so the second is recognised as a twin.

import type { MetaExport } from '../importing'

const UK3_ROWS: [account: string, campaign: string, adset: string][] = [
  ['#7759 - UK | AD 23 - Danny [ROAS A] 11343 - PP - RHKA', 'MAIN CBO FreshGaze 23', '09/17/26 Swipes'],
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/16/26 swipes'],
  ['50656 Reliore [GO DGTL]', 'REL AFFINERA RETARGET', '09/19/26 iteration'],
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/16/26 iteration'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO EASEFLOW GO R2', '09/19/26 swipes'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/16/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 20'],
  ['50656 Reliore [GO DGTL]', 'MAIN CBO MiteGuard 50656', '09/20/26 Swipes'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/15/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'SWE Revida', '09/19/26 pure swipes'],
  ['50643 reliore [GO DGTL]', 'COSTCAP REL BELLAVREN', '09/16/26 swipes - Copy'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'MAIN CBO Lidlift', '09/16/26 pure swipes'],
  ['50656 Reliore [GO DGTL]', 'SWE Revida', '09/17/26 curiosity'],
  ['#7759 - UK | AD 23 - Danny [ROAS A] 11343 - PP - RHKA', 'MAIN CBO ENERGYSAVE', '09/14/26 Swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 36 - flexi'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/16/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/20/26 swipes + playbook'],
  ['50656 Reliore [GO DGTL]', 'DIR OZEMPIL COSTCAP', '09/15/26 iteration - Copy'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 11'],
  ['50643 reliore [GO DGTL]', 'DIR Ozempil', '09/16/26 swipes + playbook'],
  ['50657 Reliore 2 [GO DGTL]', 'MAIN CBO BeeSpray GO DGTL r2', '09/20/26 swipes'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/17/26 swipes + playbook'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'MAIN CBO Lidlift', '09/15/26 pure swipes'],
  ['50643 reliore [GO DGTL]', 'REL Bellavren', '09/17/26 swipes + playbook'],
  ['50643 reliore [GO DGTL]', 'REL Revida', '09/21/26 swipes'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 8 - flexivita'],
  ['#2808 - UK | AD 1 - Danny [ROAS A] 8357 - PP - RHKA', 'MAIN CBO Flexivita', 'test 10 flexivita'],
  ['#3396 - UK | AD 7 - Danny [ROAS A] 9141 - PP - RHKA', 'MAIN CBO Lidlift', '09/08/26'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/21/26 iteration'],
  ['50656 Reliore [GO DGTL]', 'REL AFFINERA RETARGET', '09/19/26 swipes'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/16/26 swipes + playbook'],
  ['50656 Reliore [GO DGTL]', 'DIR Ozempil 19', '09/17/26 swipes + playbook'],
  ['#7759 - UK | AD 23 - Danny [ROAS A] 11343 - PP - RHKA', 'MAIN CBO ENERGYSAVE', '09/17/26 swipes + playbook'],
  ['#8185 - UK | AD 24 - Danny [ROAS A] 11281 - PP - RHKA', 'SWE Energysave 23', '09/16/26 - Copy'],
]

export const UK_21_SEP_EXPORT: MetaExport = {
  rows: UK3_ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(UK3_ROWS.map(([a]) => a))],
}
