// The ecom analyzer's "Meta Ads Review" workbook, turned into writes.
//
// The analyzer (a separate Claude project) reads the Meta export and the Shopify
// orders and produces one workbook per store and period. Four of its tabs are all
// the app needs:
//   Action plan — one header row per ad account, carrying the account's full name
//   Campaigns   — one row per campaign: SCALE / HOLD / FIX / KILL / TESTING, real ROAS
//   Ads         — account · campaign · ad set for every ad: the ad-set level book
//   New Tests   — the next test batches: "TEST ABO <product>", new ad set, brief
// Applying a review brings in what the app does not have yet, stamps every CBO with
// its verdict, marks the KILL ones killed, and creates one launch per test batch —
// Yzah's task and the setup task — exactly as if Charles had typed each one.

import { matchAccount, parseAdsetLine, type MetaExport } from './importing'
import { groupsToImportItems, planExport, type ExportGroup } from './importPlan'
import { buildAdsetName, extractAdAccountNumber, parseDateInput } from './naming'
import { campaignsInAccount, hasAdsetNamed, plannedAdsets } from './selectors'
import type { CampaignImportInput } from './store'
import type { CampaignReview, ConceptType, CreativePriority, Db, ReviewStatus } from './types'

const STATUSES: ReviewStatus[] = ['SCALE', 'HOLD', 'FIX', 'KILL', 'TESTING', 'WATCH', 'OFF']

export interface ReviewCampaign {
  status: ReviewStatus
  /** As written in the workbook: "#4286", "50677". */
  account: string
  campaign: string
  spend?: number
  orders?: number
  roas?: number
  actions?: string
}

export interface ReviewTest {
  priority: number
  account: string
  product: string
  sourceCampaign: string
  baseAds: string
  testCampaign: string
  adsetName: string
  variations: number
  budget: string
  brief: string
  killRule: string
  graduateRule: string
  status: string
}

export interface ParsedReview {
  store: string
  from: string
  to: string
  /** Account number → full display name, from the Action plan's account headers. */
  accounts: Record<string, string>
  campaigns: ReviewCampaign[]
  tests: ReviewTest[]
  ads: { account: string; campaign: string; adset: string }[]
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const squash = (s: string) => clean(s).toLowerCase()
const num = (s: string | undefined) => {
  const n = Number(s)
  return s !== undefined && s.trim() !== '' && Number.isFinite(n) ? n : undefined
}

/** The header row holding every wanted column, and where each column is. */
function header(rows: string[][], wanted: Record<string, RegExp>): { at: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].map((c) => clean(c).toLowerCase())
    const col: Record<string, number> = {}
    for (const [key, re] of Object.entries(wanted)) col[key] = cells.findIndex((c) => re.test(c))
    if (Object.values(col).every((c) => c >= 0)) return { at: i, col }
  }
  return null
}

/** Throws with a plain-English reason when the workbook is not an analyzer review. */
export function parseReview(sheets: Map<string, string[][]>): ParsedReview {
  const sheet = (name: string) => [...sheets].find(([k]) => k.trim().toLowerCase() === name)?.[1]
  const campaignsSheet = sheet('campaigns')
  const adsSheet = sheet('ads')
  if (!campaignsSheet || !adsSheet) {
    throw new Error('This is not a Meta Ads Review workbook — it has no "Campaigns" and "Ads" tabs. Upload the file the analyzer produced.')
  }

  // -- period, store, and the full account names ----------------------------
  const plan = sheet('action plan') ?? []
  const overview = sheet('overview') ?? []
  const titles = [...plan.slice(0, 3), ...overview.slice(0, 3)].map((r) => clean(r[0]))
  const period = titles.map((t) => t.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/)).find(Boolean)
  if (!period) throw new Error('Could not find the report period ("2026-09-24 to 2026-09-29") in the workbook.')
  const store =
    titles.map((t) => t.match(/—\s*([^,()]+?)\s*,\s*report/i)?.[1] ?? t.match(/\(([^()]+)\)\s*$/)?.[1]).find(Boolean) ?? ''
  const accounts: Record<string, string> = {}
  for (const r of plan) {
    const a = r[0] ?? ''
    if (!a.includes('·') || clean(r[1])) continue
    const full = clean(a.split('·')[0])
    const number = extractAdAccountNumber(full)
    if (number) accounts[number] = full
  }

  // -- Campaigns -------------------------------------------------------------
  const ch = header(campaignsSheet, {
    status: /^status$/,
    account: /^account$/,
    campaign: /^campaign$/,
    spend: /^spend/,
    orders: /^orders/,
    roas: /^roas$/,
    actions: /^actions$/,
  })
  if (!ch) throw new Error('The "Campaigns" tab does not have the expected columns (Status, Account, Campaign, Spend, Orders, ROAS, Actions).')
  const campaigns: ReviewCampaign[] = []
  for (const r of campaignsSheet.slice(ch.at + 1)) {
    const status = clean(r[ch.col.status]).toUpperCase() as ReviewStatus
    const campaign = clean(r[ch.col.campaign])
    const account = clean(r[ch.col.account])
    if (!STATUSES.includes(status) || !campaign || !account) continue
    campaigns.push({
      status,
      account,
      campaign,
      spend: num(r[ch.col.spend]),
      orders: num(r[ch.col.orders]),
      roas: num(r[ch.col.roas]),
      actions: clean(r[ch.col.actions]) || undefined,
    })
  }
  if (campaigns.length === 0) throw new Error('The "Campaigns" tab has no campaign rows.')

  // -- Ads: the ad-set level book --------------------------------------------
  const ah = header(adsSheet, { account: /^account$/, campaign: /^campaign$/, adset: /^ad set$/ })
  if (!ah) throw new Error('The "Ads" tab does not have the expected columns (Account, Campaign, Ad set).')
  const seen = new Set<string>()
  const ads: ParsedReview['ads'] = []
  for (const r of adsSheet.slice(ah.at + 1)) {
    const row = { account: clean(r[ah.col.account]), campaign: clean(r[ah.col.campaign]), adset: clean(r[ah.col.adset]) }
    if (!row.account || !row.campaign || !row.adset) continue
    const key = `${row.account}|${squash(row.campaign)}|${row.adset}`
    if (seen.has(key)) continue
    seen.add(key)
    ads.push(row)
  }

  // -- New Tests (optional: a review can have none) ---------------------------
  const tests: ReviewTest[] = []
  const testsSheet = sheet('new tests')
  const th = testsSheet
    ? header(testsSheet, {
        priority: /^priority$/,
        account: /^account$/,
        product: /^product$/,
        source: /^source campaign$/,
        base: /^base ad/,
        testCampaign: /^test campaign/,
        adset: /^new ad set name$/,
        variations: /^variations$/,
        budget: /^budget/,
        brief: /^creative brief$/,
        kill: /^kill rule$/,
        graduate: /^graduate rule$/,
        status: /^status$/,
      })
    : null
  if (testsSheet && th) {
    for (const r of testsSheet.slice(th.at + 1)) {
      const account = clean(r[th.col.account])
      const adsetName = clean(r[th.col.adset])
      const testCampaign = clean(r[th.col.testCampaign])
      if (!account || !adsetName || !testCampaign) continue
      tests.push({
        priority: num(r[th.col.priority]) ?? 2,
        account,
        product: clean(r[th.col.product]),
        sourceCampaign: clean(r[th.col.source]),
        baseAds: clean(r[th.col.base]),
        testCampaign,
        adsetName,
        variations: Math.max(1, Math.round(num(r[th.col.variations]) ?? 4)),
        budget: clean(r[th.col.budget]),
        brief: clean(r[th.col.brief]),
        killRule: clean(r[th.col.kill]),
        graduateRule: clean(r[th.col.graduate]),
        status: clean(r[th.col.status]),
      })
    }
  }

  return { store: clean(store), from: period[1], to: period[2], accounts, campaigns, tests, ads }
}

// ---------------------------------------------------------------------------
// Planning — what applying the review will write, against the database as it is.

/** One test batch, ready for the store: names only, resolved again at apply time. */
export interface ReviewTestInput {
  accountNumber: string
  productName: string
  testCampaignName: string
  /** `YYYY-MM-DD`, read from the front of the analyzer's ad-set name. */
  launchDate: string
  conceptType: ConceptType
  conceptLabel: string
  quantity: number
  priority: CreativePriority
  direction: string
  setupInstructions: string
}

export interface ReviewApplyInput {
  /** "Serenorth 2026-09-24 to 2026-09-29" — for the activity log. */
  label: string
  importItems: CampaignImportInput[]
  statuses: { accountNumber: string; campaignName: string; review: Omit<CampaignReview, 'appliedAt'> }[]
  kills: { accountNumber: string; campaignName: string }[]
  tests: ReviewTestInput[]
}

export interface PlannedTest {
  row: ReviewTest
  accountName: string
  adsetName: string
  /** The TEST ABO campaign is not in the app yet — setup creates it in Meta. */
  createsCampaign: boolean
  input?: ReviewTestInput
  /** Already created by an earlier apply of the same review. */
  already?: boolean
  problem?: string
}

export interface ReviewPlan {
  review: ParsedReview
  groups: ExportGroup[]
  /** Campaigns that get a verdict chip, by status. */
  statusCounts: Partial<Record<ReviewStatus, number>>
  kills: { name: string; accountName: string }[]
  killBlocked: string[]
  tests: PlannedTest[]
  /** Things left alone, and why. */
  notes: string[]
  input: ReviewApplyInput
}

export interface ReviewOptions {
  /** Mark the KILL campaigns as killed in the app. */
  kill: boolean
  /** Create the launches for the New Tests tab. */
  tests: boolean
}

export function planReview(db: Db, review: ParsedReview, opts: ReviewOptions): ReviewPlan {
  const notes: string[] = []
  const fullName = (short: string) => review.accounts[extractAdAccountNumber(short)] ?? short
  const accountOf = (short: string) => matchAccount(fullName(short), db.adAccounts)
  const sameName = (a: string, b: string) => squash(a) === squash(b)

  // -- where every reviewed campaign stands in the app today ------------------
  const standing = review.campaigns.map((rc) => {
    const acc = accountOf(rc.account)
    const active = acc ? campaignsInAccount(db, acc.id).find((c) => sameName(c.name, rc.campaign)) : undefined
    const killed = acc
      ? db.campaigns.find((c) => c.adAccountId === acc.id && c.status === 'KILLED' && sameName(c.name, rc.campaign))
      : undefined
    const knowsAccount = Boolean(acc) || Boolean(review.accounts[extractAdAccountNumber(rc.account)])
    return { rc, acc, active, killed, knowsAccount }
  })

  // -- import: what the app does not have yet ---------------------------------
  const wanted = new Set<string>()
  for (const s of standing) {
    const key = `${extractAdAccountNumber(s.rc.account)}|${squash(s.rc.campaign)}`
    const off = s.rc.status === 'KILL' || s.rc.status === 'OFF'
    if (s.active) wanted.add(key)
    else if (s.killed) {
      if (!off) notes.push(`${s.rc.campaign} is killed in the app but the review has it as ${s.rc.status} — revive it from the Killed filter if it is running.`)
    } else if (off) notes.push(`${s.rc.campaign} (${s.rc.account}) is not in the app and is being turned off — left out.`)
    else if (!s.knowsAccount) notes.push(`${s.rc.campaign}: account ${s.rc.account} is not in the app and the review does not give its full name — add it in Ad Accounts, then apply again.`)
    else if (s.acc?.status === 'OFFBOARDED') notes.push(`${s.rc.campaign}: ${s.acc.displayName} is off-boarded in the app — left out.`)
    else wanted.add(key)
  }
  const rows = review.ads
    .filter((a) => wanted.has(`${extractAdAccountNumber(a.account)}|${squash(a.campaign)}`))
    .map((a) => ({ account: fullName(a.account), campaign: a.campaign, adset: a.adset }))
  const book: MetaExport = {
    rows,
    columns: { campaign: 'Campaign', adset: 'Ad set', account: 'Account' },
    accounts: [...new Set(rows.map((r) => r.account))],
  }
  const groups = planExport(db, '', book, { skipOff: false, products: {}, accounts: {}, deriveProducts: true })
  for (const g of groups) {
    if (g.problem && !g.problem.startsWith('Nothing new')) notes.push(`${g.campaignName}: ${g.problem}`)
  }
  const importItems = groupsToImportItems(groups)
  const arriving = new Set(
    groups.filter((g) => !g.problem && !g.existingId).map((g) => `${extractAdAccountNumber(g.accountName ?? '')}|${squash(g.campaignName)}`),
  )
  const newAccountNumbers = new Set(
    groups.filter((g) => !g.problem && !g.accountId && g.newAccount).map((g) => extractAdAccountNumber(g.newAccount!.displayName)),
  )

  // -- verdicts and kills ------------------------------------------------------
  const statuses: ReviewApplyInput['statuses'] = []
  const statusCounts: Partial<Record<ReviewStatus, number>> = {}
  const kills: ReviewPlan['kills'] = []
  const killBlocked: string[] = []
  for (const s of standing) {
    const accountNumber = extractAdAccountNumber(s.rc.account)
    const here = Boolean(s.active) || arriving.has(`${accountNumber}|${squash(s.rc.campaign)}`)
    if (!here) continue
    statuses.push({
      accountNumber,
      campaignName: s.rc.campaign,
      review: {
        status: s.rc.status,
        roas: s.rc.roas,
        spend: s.rc.spend,
        orders: s.rc.orders,
        actions: s.rc.actions,
        from: review.from,
        to: review.to,
      },
    })
    statusCounts[s.rc.status] = (statusCounts[s.rc.status] ?? 0) + 1
    if (s.rc.status === 'KILL' && s.active && opts.kill) {
      if (plannedAdsets(db, s.active.id).length > 0) killBlocked.push(s.active.name)
      else kills.push({ name: s.active.name, accountName: s.acc?.displayName ?? s.rc.account })
    }
  }

  // -- test batches --------------------------------------------------------------
  const tests: PlannedTest[] = review.tests.map((row): PlannedTest => {
    const acc = accountOf(row.account)
    const accountNumber = extractAdAccountNumber(row.account)
    const accountName = acc?.displayName ?? fullName(row.account)
    const base = { row, accountName, adsetName: row.adsetName, createsCampaign: true }
    if (row.status && !/^planned$/i.test(row.status)) return { ...base, already: true, problem: `Marked "${row.status}" in the review.` }
    const parsed = parseAdsetLine(row.adsetName)
    if (!parsed?.launchedAt) return { ...base, problem: `"${row.adsetName}" does not start with a launch date (MM/DD/YY).` }
    if (!acc && !newAccountNumbers.has(accountNumber)) return { ...base, problem: `Account ${row.account} is not in the app.` }
    if (acc?.status === 'OFFBOARDED') return { ...base, problem: `${acc.displayName} is off-boarded.` }
    const d = new Date(parsed.launchedAt)
    const launchDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const conceptLabel = row.adsetName.replace(/^\S+\s*/, '').trim()
    const adsetName = buildAdsetName(parseDateInput(launchDate), conceptLabel)
    const existing = acc ? campaignsInAccount(db, acc.id).find((c) => sameName(c.name, row.testCampaign)) : undefined
    if (existing && hasAdsetNamed(db, existing.id, adsetName)) {
      return { ...base, adsetName, createsCampaign: false, already: true, problem: 'Already created.' }
    }
    const budget = row.budget ? `, €${row.budget}/day` : ''
    return {
      ...base,
      adsetName,
      createsCampaign: !existing,
      input: {
        accountNumber,
        productName: row.product,
        testCampaignName: row.testCampaign,
        launchDate,
        conceptType: parsed.conceptType === 'CUSTOM' || parsed.conceptType === 'SWIPES_PLAYBOOK' ? 'ITERATION' : parsed.conceptType,
        conceptLabel,
        quantity: row.variations,
        priority: row.priority <= 1 ? 'HIGH' : row.priority === 2 ? 'NORMAL' : 'LOW',
        direction: [row.brief, row.baseAds ? `Base ads: ${row.baseAds} — in ${row.sourceCampaign}.` : ''].filter(Boolean).join('\n'),
        setupInstructions: [
          `Create ad set "${adsetName}" in ${row.testCampaign} (ABO${budget})${existing ? '' : ' — create the campaign first, in this ad account'}.`,
          row.killRule ? `Kill rule: ${row.killRule}` : '',
          row.graduateRule ? `Graduate rule: ${row.graduateRule}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    }
  })

  return {
    review,
    groups,
    statusCounts,
    kills,
    killBlocked,
    tests,
    notes,
    input: {
      label: `${review.store} ${review.from} to ${review.to}`.trim(),
      importItems,
      statuses,
      kills: kills.map((k) => {
        const s = standing.find((x) => x.active?.name === k.name && (x.acc?.displayName ?? x.rc.account) === k.accountName)!
        return { accountNumber: extractAdAccountNumber(s.rc.account), campaignName: s.rc.campaign }
      }),
      tests: opts.tests ? tests.flatMap((t) => (t.input ? [t.input] : [])) : [],
    },
  }
}
