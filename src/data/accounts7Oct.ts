// The ad-account directory as of 7 Oct 2026 — the two supplier panels Charles
// pasted ("these are the ad accounts we have right now"), active accounts only.
// GO DGTL: 33 (the deactivated SHM rows and the pending / disabled N/A rows are
// left out). The ROAS panel: 15, nine tagged RHKA and six tagged [ADSOL].
// Names verbatim from the panels; the market comes from the panel's own label.

export interface AccountSpec {
  displayName: string
  /** Country id in the app: c_uk, c_ca, c_au, c_us. */
  countryId: string
  supplier: string
  /** The supplier's own label — "DGTL | UK | AD 1", "UK 1 - GH 1". */
  supplierRef?: string
  timezone?: string
  store?: string
  /** Only when the name does not start with the number ("Account 5465 [GO DGTL]"). */
  number?: string
}

const TZ: Record<string, string> = {
  c_uk: 'Europe/London',
  c_ca: 'America/Toronto',
  c_au: 'Australia/Sydney',
  c_us: 'America/New_York',
}

const STORE: Record<string, string> = { c_uk: 'Reliore', c_ca: 'Serenorth', c_au: 'Aurmacy', c_us: 'Amermacy' }

function dgtl(displayName: string, countryId: string, ref: string, number?: string): AccountSpec {
  return { displayName, countryId, supplier: 'GO DGTL', supplierRef: ref, timezone: TZ[countryId], store: STORE[countryId], number }
}

function roas(displayName: string, countryId: string): AccountSpec {
  const supplier = /\bADSOL\b/.test(displayName) ? 'ADSOL' : 'RHKA'
  const ref = displayName.match(/^#\d+\s*-\s*(.+?)\s*-\s*Danny/)?.[1]
  return { displayName, countryId, supplier, supplierRef: ref ? `${supplier} | ${ref}` : undefined, timezone: TZ[countryId] }
}

export const ACCOUNTS_7_OCT: AccountSpec[] = [
  // GO DGTL panel
  { ...dgtl('Account 5465 [GO DGTL]', 'c_uk', 'UK 1 - GH 1', '5465'), store: undefined },
  dgtl('50643 reliore [GO DGTL]', 'c_uk', 'DGTL | UK | AD 1'),
  dgtl('50655 Serenorth [GO DGTL]', 'c_ca', 'DGTL | CA | AD 1'),
  dgtl('50647 aurmacy [GO DGTL]', 'c_au', 'DGTL | AUS | AD 1'),
  dgtl('50652 amermacy [GO DGTL]', 'c_us', 'DGTL | US | AD 1'),
  dgtl('50656 Reliore [GO DGTL]', 'c_uk', 'DGTL | UK | AD 2'),
  dgtl('50657 Reliore 2 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 3'),
  dgtl('50676 Serenorth 3 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 2'),
  dgtl('50660 Serenorth [GO DGTL]', 'c_ca', 'DGTL | CA | AD 4'),
  dgtl('50677 Serenorth 4 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 5'),
  dgtl('50661 Amermacy [GO DGTL]', 'c_us', 'DGTL | US | AD 2'),
  dgtl('50662 Amermacy 2 [GO DGTL]', 'c_us', 'DGTL | US | AD 3'),
  dgtl('50663 Amermacy 3 [GO DGTL]', 'c_us', 'DGTL | US | AD 4'),
  dgtl('50664 Amermacy 4 [GO DGTL]', 'c_us', 'DGTL | US | AD 5'),
  dgtl('50674 Aurmacy 4 [GO DGTL]', 'c_au', 'DGTL | AUS | AD 2'),
  dgtl('50675 Aurmacy 5 [GO DGTL]', 'c_au', 'DGTL | AUS | AD 3'),
  dgtl('50659 Aurmacy [GO DGTL]', 'c_au', 'DGTL | AUS | AD 4'),
  dgtl('50658 Aurmacy [GO DGTL]', 'c_au', 'DGTL | AUS | AD 5'),
  dgtl('50752 Reliore 4 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 4'),
  dgtl('50753 Reliore 5 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 5'),
  dgtl('50754 Reliore 6 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 6'),
  dgtl('50708 Serenorth 5 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 3'),
  dgtl('50712 Serenorth 5 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 6'),
  dgtl('50760 Reliore 7 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 7'),
  dgtl('50761 Reliore 8 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 8'),
  dgtl('50762 Reliore 9 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 9'),
  dgtl('50763 Reliore 10 [GO DGTL]', 'c_uk', 'DGTL | UK | AD 10'),
  dgtl('50766 Serenorth 2 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 7'),
  dgtl('50767 Serenorth 3 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 8'),
  dgtl('50768 Serenorth 4 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 8'),
  dgtl('50769 Serenorth 5 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 9'),
  dgtl('50770 Serenorth 6 [GO DGTL]', 'c_ca', 'DGTL | CA | AD 11'),
  dgtl('50765 Serenorth [GO DGTL]', 'c_ca', 'DGTL | CA | AD 13'),

  // ROAS panel — RHKA and the new [ADSOL] tag
  roas('#10061 - UK | AD 32 - Danny - [ADSOL]', 'c_uk'),
  roas('#10060 - UK | AD 33 - Danny - [ADSOL]', 'c_uk'),
  roas('#10059 - UK | AD 34 - Danny - [ADSOL]', 'c_uk'),
  roas('#10058 - UK | AD 34 - Danny - [ADSOL]', 'c_uk'),
  roas('#10057 - CANADA | AD 32 - Danny - [ADSOL]', 'c_ca'),
  roas('#10036 - CANADA | AD 34 - Danny - [ADSOL]', 'c_ca'),
  roas('#6799 - CANADA | AD 35 - Danny [ROAS A] 12266 - PP - RHKA', 'c_ca'),
  roas('#3705 - CANADA | AD 34 - Danny [ROAS A] 12264 - PP - RHKA', 'c_ca'),
  roas('#4196 - CANADA | AD 33 - Danny [ROAS A] 12263 - PP - RHKA', 'c_ca'),
  roas('#4861 - UK | AD 29 - Danny [ROAS A] 12250 - PP - RHKA', 'c_uk'),
  roas('#5361 - UK | AD 30 - Danny [ROAS A] 12249 - PP - RHKA', 'c_uk'),
  roas('#6539 - UK | AD 28 - Danny [ROAS A] 12248 - PP - RHKA', 'c_uk'),
  roas('#1240 - CANADA | AD 27 - Danny [ROAS A] 12247 - PP - RHKA', 'c_ca'),
  roas('#7713 - CANADA | AD 28 - Danny [ROAS A] 12246 - PP - RHKA', 'c_ca'),
  roas('#7733 - CANADA | AD 29 - Danny [ROAS A] 12245 - PP - RHKA', 'c_ca'),
]

/**
 * Suppliers whose panel is the whole truth: an account of theirs not listed is gone.
 * GO DGTL only — the ROAS panel paste showed just the accounts created on 5–6 Oct,
 * while older RHKA accounts (#4286, #9570) were still spending that day.
 */
export const ACCOUNTS_7_OCT_SUPPLIERS = ['GO DGTL']
