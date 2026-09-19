// The AUS GO DGTL book — from two Ads Reporting pivot pastes (18 and 19 Sep 2026).
// Pivot copies arrive truncated and out of order, so only what the spend totals
// place is here:
//   50659 Aurmacy   161.42 = NEW CBO Vitalith 64.05 + SWE Vitalith 65.95 + SWE Revida GO50659 31.42
//   50658 Aurmacy   122.92 = HemoHeal 25.45 + OmegaMax GO 58.17 + SWE Omegamax 34.97 + Snorestop 4.33
//   SWE Omegamax     34.97 = 20.50 + 9.63 + 4.84        MAIN CBO OmegaMax GO 58.17 = 52.01 + 5.14 + 1.02
// NEW CBO Snorestop is left out: Charles killed it (and Curcuvera) on 19 Sep.
// MAIN CBO Revida GO on 50674 is the one soft spot: its four ad sets come from two
// pastes whose totals differ by a few cents, and "09/16/26 - Copy" is placed by
// position only. Roughly 42 euro of other spend on 50674 was never in a paste.

import type { MetaExport } from '../importing'

const AUS_ROWS: [account: string, campaign: string, adset: string][] = [
  ['50659 Aurmacy [GO DGTL]', 'NEW CBO Vitalith', '09/16/26'],
  ['50659 Aurmacy [GO DGTL]', 'NEW CBO Vitalith', '09/17/26 swipes + playbook'],
  ['50659 Aurmacy [GO DGTL]', 'SWE Vitalith', '09/16/26'],
  ['50659 Aurmacy [GO DGTL]', 'SWE Vitalith', '09/17/26 swipes + playbook'],
  ['50659 Aurmacy [GO DGTL]', 'SWE Revida GO50659', '09/18/26 swipes + playbook'],

  ['50658 Aurmacy [GO DGTL]', 'NEW CBO HemoHeal go', '09/19/26'],
  ['50658 Aurmacy [GO DGTL]', 'MAIN CBO OmegaMax GO', '09/16/26 iterations'],
  ['50658 Aurmacy [GO DGTL]', 'MAIN CBO OmegaMax GO', '09/17/26 iteration'],
  ['50658 Aurmacy [GO DGTL]', 'MAIN CBO OmegaMax GO', '09/16/26 swipes'],
  ['50658 Aurmacy [GO DGTL]', 'SWE Omegamax', '09/16/26 swipes'],
  ['50658 Aurmacy [GO DGTL]', 'SWE Omegamax', '09/16/26 iterations'],
  ['50658 Aurmacy [GO DGTL]', 'SWE Omegamax', '09/17/26 iteration'],

  ['50674 Aurmacy 4 [GO DGTL]', 'MAIN CBO Revida GO', '09/16/26 Iterations'],
  ['50674 Aurmacy 4 [GO DGTL]', 'MAIN CBO Revida GO', '09/18/26 Iterations 2'],
  ['50674 Aurmacy 4 [GO DGTL]', 'MAIN CBO Revida GO', '09/16/26 swipes'],
  ['50674 Aurmacy 4 [GO DGTL]', 'MAIN CBO Revida GO', '09/16/26 - Copy'],
]

export const AUS_EXPORT: MetaExport = {
  rows: AUS_ROWS.map(([account, campaign, adset]) => ({ account, campaign, adset })),
  columns: { campaign: 'Campaign name', adset: 'Ad set name', account: 'Account name' },
  accounts: [...new Set(AUS_ROWS.map(([a]) => a))],
}
