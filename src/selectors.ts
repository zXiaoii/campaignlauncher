// Pure read functions over the Db. No React here — these are the queries the
// real API would expose, and the UI reads nothing it cannot get from this file.

import { MAX_ADSETS_PER_CAMPAIGN, sameDay } from './naming'
import type {
  AdAccount,
  Adset,
  AdsetStatus,
  Campaign,
  CreativeBatch,
  CreativeTask,
  Db,
  Followup,
  Launch,
  Product,
  SetupTask,
  User,
} from './types'

/**
 * Which ad-set statuses occupy one of a campaign's three slots.
 *
 * ASSUMPTION (not stated in the PRD): killed and archived ad sets release their
 * slot, otherwise a CBO could never be refreshed and §7 relaunches would be
 * impossible. Stopped ad sets still occupy a slot because they exist in Meta.
 */
export const OCCUPYING_STATUSES: AdsetStatus[] = ['PLANNED', 'ACTIVE', 'STOPPED']

/** Statuses that put an ad set in the old/killed Library (§7.5). */
export const LIBRARY_STATUSES: AdsetStatus[] = ['KILLED', 'STOPPED', 'ARCHIVED']

export const byId = <T extends { id: string }>(rows: T[], id?: string): T | undefined =>
  id ? rows.find((r) => r.id === id) : undefined

export const user = (db: Db, id?: string) => byId(db.users, id)
export const product = (db: Db, id?: string) => byId(db.products, id)
export const adAccount = (db: Db, id?: string) => byId(db.adAccounts, id)
export const campaign = (db: Db, id?: string) => byId(db.campaigns, id)
export const adset = (db: Db, id?: string) => byId(db.adsets, id)
export const batch = (db: Db, id?: string) => byId(db.creativeBatches, id)
export const launch = (db: Db, id?: string) => byId(db.launches, id)

export const userName = (db: Db, id?: string) => user(db, id)?.name ?? '—'

export function countryOfAccount(db: Db, accountId: string) {
  const acc = adAccount(db, accountId)
  return acc ? byId(db.countries, acc.countryId) : undefined
}

/** Accounts the workspace and launch pickers work with — off-boarded ones are gone. */
export function accountsInCountry(db: Db, countryId: string): AdAccount[] {
  return db.adAccounts
    .filter((a) => a.countryId === countryId && a.status !== 'OFFBOARDED')
    .sort((a, b) => a.adAccountNumber.localeCompare(b.adAccountNumber))
}

export function campaignsInAccount(db: Db, accountId: string): Campaign[] {
  return db.campaigns
    .filter((c) => c.adAccountId === accountId && c.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function adsetsInCampaign(db: Db, campaignId: string): Adset[] {
  return db.adsets
    .filter((a) => a.campaignId === campaignId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Live ad sets — the ones that count against the hard maximum of 3. */
export function liveAdsets(db: Db, campaignId: string): Adset[] {
  return adsetsInCampaign(db, campaignId).filter((a) =>
    OCCUPYING_STATUSES.includes(a.status),
  )
}

export function slotsUsed(db: Db, campaignId: string): number {
  return liveAdsets(db, campaignId).length
}

export function isCampaignFull(db: Db, campaignId: string): boolean {
  return slotsUsed(db, campaignId) >= MAX_ADSETS_PER_CAMPAIGN
}

/** Ad sets created but not yet launched — a batch still in Yzah's or setup's hands. */
export function plannedAdsets(db: Db, campaignId: string): Adset[] {
  return adsetsInCampaign(db, campaignId).filter((a) => a.status === 'PLANNED')
}

/** Exact-name collision inside one CBO. Names are copied into Meta verbatim, so twins are never OK. */
export function hasAdsetNamed(db: Db, campaignId: string, name: string): boolean {
  return db.adsets.some((a) => a.campaignId === campaignId && a.name === name)
}

export function campaignOfAdset(db: Db, adsetId: string): Campaign | undefined {
  const a = adset(db, adsetId)
  return a ? campaign(db, a.campaignId) : undefined
}

// ---------------------------------------------------------------------------
// Denormalized row used by every table and drawer in the app.

export interface LaunchRow {
  launch: Launch
  adset: Adset
  campaign: Campaign
  account: AdAccount
  countryCode: string
  product: Product
  batch?: CreativeBatch
  creativeTask?: CreativeTask
  setupTask?: SetupTask
  /** Source ad set this launch was created from, when any (§3.3 source badge). */
  sourceAdset?: Adset
  sourceCampaign?: Campaign
  sourceBatch?: CreativeBatch
}

export function launchRow(db: Db, l: Launch): LaunchRow | undefined {
  const ad = adset(db, l.destinationAdsetId)
  const cm = campaign(db, l.destinationCampaignId)
  if (!ad || !cm) return undefined
  const acc = adAccount(db, cm.adAccountId)
  const prod = product(db, cm.productId)
  if (!acc || !prod) return undefined
  const country = byId(db.countries, acc.countryId)
  const src = adset(db, l.sourceAdsetId)
  return {
    launch: l,
    adset: ad,
    campaign: cm,
    account: acc,
    countryCode: country?.code ?? '',
    product: prod,
    batch: batch(db, ad.creativeBatchId),
    creativeTask: db.creativeTasks.find((t) => t.launchId === l.id),
    setupTask: db.setupTasks.find((t) => t.launchId === l.id),
    sourceAdset: src,
    sourceCampaign: src ? campaign(db, src.campaignId) : undefined,
    sourceBatch: batch(db, l.sourceBatchId),
  }
}

/**
 * Every screen derives from this, several times per render. The Db object is
 * immutable per state (the reducer always returns a new one), so a WeakMap keyed on
 * it is a free, leak-proof memo: one denormalization per state change, not one per
 * table per render.
 */
const rowsCache = new WeakMap<Db, LaunchRow[]>()

export function allLaunchRows(db: Db): LaunchRow[] {
  const cached = rowsCache.get(db)
  if (cached) return cached
  const rows = db.launches
    .map((l) => launchRow(db, l))
    .filter((r): r is LaunchRow => Boolean(r))
  rowsCache.set(db, rows)
  return rows
}

export function rowForAdset(db: Db, adsetId: string): LaunchRow | undefined {
  const l = db.launches.find((x) => x.destinationAdsetId === adsetId)
  return l ? launchRow(db, l) : undefined
}

export function rowForCreativeTask(db: Db, taskId: string): LaunchRow | undefined {
  const t = byId(db.creativeTasks, taskId)
  const l = t ? launch(db, t.launchId) : undefined
  return l ? launchRow(db, l) : undefined
}

export function rowForSetupTask(db: Db, taskId: string): LaunchRow | undefined {
  const t = byId(db.setupTasks, taskId)
  const l = t ? launch(db, t.launchId) : undefined
  return l ? launchRow(db, l) : undefined
}

// ---------------------------------------------------------------------------
// Task queues

const PRIORITY_ORDER: Record<CreativeTask['priority'], number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
}

/** Yzah's queue order: priority first, then due date. */
export function creativeRows(db: Db): LaunchRow[] {
  return allLaunchRows(db)
    .filter((r) => r.creativeTask)
    .sort((a, b) => {
      const ta = a.creativeTask!
      const tb = b.creativeTask!
      const p = PRIORITY_ORDER[ta.priority] - PRIORITY_ORDER[tb.priority]
      if (p !== 0) return p
      return ta.dueAt < tb.dueAt ? -1 : 1
    })
}

export function openCreativeRows(db: Db): LaunchRow[] {
  return creativeRows(db).filter((r) => r.creativeTask!.status === 'TODO')
}

export function setupRows(db: Db): LaunchRow[] {
  return allLaunchRows(db)
    .filter((r) => r.setupTask)
    .sort((a, b) => (a.setupTask!.dueAt < b.setupTask!.dueAt ? -1 : 1))
}

/** One shared queue — Karl and Christian pick from it themselves. */
export function openSetupRows(db: Db): LaunchRow[] {
  return setupRows(db).filter((r) => r.setupTask!.status !== 'COMPLETED')
}

// ---------------------------------------------------------------------------
// Library (§7.5) — historical ad sets only, no metrics.

export function libraryRows(db: Db): LaunchRow[] {
  return allLaunchRows(db)
    .filter((r) => LIBRARY_STATUSES.includes(r.adset.status))
    .sort((a, b) => (a.adset.name < b.adset.name ? 1 : -1))
}

/** Every batch that has a Drive link and so can be reused as-is. */
export function reusableBatches(db: Db): CreativeBatch[] {
  return db.creativeBatches
    .filter((b) => Boolean(b.driveUrl))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

// ---------------------------------------------------------------------------
// Day-by-day launches (§12.2). A launch counts as launched when setup completes.

export function launchesOnDay(db: Db, day: Date): LaunchRow[] {
  return allLaunchRows(db)
    .filter((r) => r.launch.launchedAt && sameDay(r.launch.launchedAt, day))
    .sort((a, b) => (a.launch.launchedAt! < b.launch.launchedAt! ? -1 : 1))
}

export interface AccountGroup {
  account: AdAccount
  countryCode: string
  campaigns: { campaign: Campaign; rows: LaunchRow[] }[]
}

/** Groups rows into country → ad account → campaign, the shape both visual views use. */
export function groupByAccount(rows: LaunchRow[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>()
  for (const row of rows) {
    let g = groups.get(row.account.id)
    if (!g) {
      g = { account: row.account, countryCode: row.countryCode, campaigns: [] }
      groups.set(row.account.id, g)
    }
    let c = g.campaigns.find((x) => x.campaign.id === row.campaign.id)
    if (!c) {
      c = { campaign: row.campaign, rows: [] }
      g.campaigns.push(c)
    }
    c.rows.push(row)
  }
  return [...groups.values()].sort((a, b) =>
    a.account.adAccountNumber.localeCompare(b.account.adAccountNumber),
  )
}

// ---------------------------------------------------------------------------
// 48-hour follow-up helper (§13.1). Purely time-based — no metrics anywhere.

const FOLLOWUP_WINDOW_MS = 48 * 60 * 60 * 1000

/** The slice of an ad set the follow-up card needs. No launch record required. */
export interface FollowupRow {
  adset: Adset
  campaign: Campaign
  account: AdAccount
  product: Product
}

export interface FollowupCandidate {
  row: FollowupRow
  eligibleAt: string
  slotsUsed: number
  isFull: boolean
  existing?: Followup
}

/**
 * Works from the ad sets, not from launches — an ad set imported from Meta with
 * a date in its name and no launch history is exactly the kind that needs the
 * 48-hour nudge.
 */
export function followupCandidates(db: Db, now: Date): FollowupCandidate[] {
  return db.adsets
    .filter((a) => a.status === 'ACTIVE' && a.launchedAt)
    .flatMap((a) => {
      const cm = campaign(db, a.campaignId)
      const acc = cm ? adAccount(db, cm.adAccountId) : undefined
      const prod = cm ? product(db, cm.productId) : undefined
      if (!cm || !acc || !prod) return []
      const eligibleAt = new Date(new Date(a.launchedAt!).getTime() + FOLLOWUP_WINDOW_MS)
      return [
        {
          row: { adset: a, campaign: cm, account: acc, product: prod },
          eligibleAt: eligibleAt.toISOString(),
          slotsUsed: slotsUsed(db, cm.id),
          isFull: isCampaignFull(db, cm.id),
          existing: db.followups.find((f) => f.sourceAdsetId === a.id),
        },
      ]
    })
    .filter((c) => new Date(c.eligibleAt).getTime() <= now.getTime())
    .filter((c) => !c.existing || c.existing.status === 'OPEN')
    .sort((a, b) => (a.eligibleAt < b.eligibleAt ? -1 : 1))
}

// ---------------------------------------------------------------------------
// Mark's setup counters (§11.1)

export interface SetupCounters {
  completed: number
  ready: number
  waiting: number
  late: number
}

export function setupCounters(
  rows: LaunchRow[],
  now: Date,
): SetupCounters {
  const counters: SetupCounters = { completed: 0, ready: 0, waiting: 0, late: 0 }
  for (const r of rows) {
    const t = r.setupTask!
    if (t.status === 'COMPLETED') counters.completed += 1
    else if (t.status === 'READY') counters.ready += 1
    else counters.waiting += 1
    if (t.status !== 'COMPLETED' && new Date(t.dueAt).getTime() < now.getTime()) {
      counters.late += 1
    }
  }
  return counters
}

/**
 * Mark's day window (§11.1 Today / Yesterday / This Week). A setup task belongs to
 * the window if it was completed inside it, or is still open and was due inside it.
 *
 * Overdue open tasks also carry forward into any window that reaches the present —
 * otherwise yesterday's unfinished setup would vanish from Today and the Late
 * counter, which is the one number Mark is watching for.
 */
export function setupRowsInWindow(
  db: Db,
  from: Date,
  to: Date,
  now: Date,
): LaunchRow[] {
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= from.getTime() && t <= to.getTime()
  }
  const windowReachesNow = to.getTime() >= now.getTime()
  return setupRows(db).filter((r) => {
    const t = r.setupTask!
    if (t.completedAt) return inRange(t.completedAt)
    if (inRange(t.dueAt)) return true
    return windowReachesNow && new Date(t.dueAt).getTime() < from.getTime()
  })
}

export function activeUsersWithRole(db: Db, role: User['role']): User[] {
  return db.users.filter((u) => u.role === role && u.active)
}

// ---------------------------------------------------------------------------
// Setup-team activity — the feed behind the notification bell.

export type SetupEventKind =
  | 'COMPLETED'
  | 'BLOCKED'
  | 'UNBLOCKED'
  | 'ACCOUNT'
  | 'QA'
  | 'SUBMITTED'
  | 'REQUEST'
  /** Charles wrote or changed the instructions on a setup task. */
  | 'INSTRUCTIONS'

export interface SetupEvent {
  id: string
  at: string
  actorId: string
  actorName: string
  kind: SetupEventKind
  /** One line, past tense, names included — reads the same in a toast and the feed. */
  text: string
  /** Where clicking the notification should land, when there is somewhere to land. */
  adsetId?: string
}

const SETUP_EVENT_TYPES = new Set([
  'SETUP_COMPLETED',
  'SETUP_BLOCKED',
  'SETUP_UNBLOCKED',
  'ACCOUNT_STATUS_SET',
  'SETUP_QA_CHECKED',
])

const CREATIVE_EVENT_TYPES = new Set([
  'CREATIVE_SUBMITTED',
  'CREATIVE_SUBMISSION_UPDATED',
  'CREATIVE_REQUEST_RAISED',
])

/**
 * What a viewer's feed may contain. Mark never sees the creative side (§11);
 * everyone else sees both halves of the handover.
 */
export function eventKindsFor(role: User['role']): Set<SetupEventKind> {
  const setup: SetupEventKind[] = ['COMPLETED', 'BLOCKED', 'UNBLOCKED', 'ACCOUNT', 'QA', 'INSTRUCTIONS']
  const creative: SetupEventKind[] = ['SUBMITTED', 'REQUEST']
  return new Set(role === 'SETUP_QA' ? setup : [...setup, ...creative])
}

/**
 * The handover feed, newest first: what the setup side did, and Yzah's
 * submissions and requests. Derived from the activity log, so it is complete
 * and survives reloads; the "unread" line is per viewer and lives in the UI.
 */
export function setupEvents(db: Db, limit = 50): SetupEvent[] {
  const out: SetupEvent[] = []
  for (const l of [...db.activityLogs].reverse()) {
    const actor = user(db, l.userId)
    if (!actor) continue

    if (CREATIVE_EVENT_TYPES.has(l.eventType) && actor.role === 'CREATIVE') {
      const row = rowForCreativeTask(db, l.entityId)
      if (!row) continue
      const where = `${row.adset.name} · ${row.campaign.name}`
      if (l.eventType === 'CREATIVE_REQUEST_RAISED') {
        const note = typeof l.metadata?.note === 'string' ? ` — ${l.metadata.note}` : ''
        out.push({
          id: l.id,
          at: l.createdAt,
          actorId: actor.id,
          actorName: actor.name,
          kind: 'REQUEST',
          text: `${actor.name} asked about ${where}${note}`,
          adsetId: row.adset.id,
        })
      } else {
        const updated = l.eventType === 'CREATIVE_SUBMISSION_UPDATED'
        out.push({
          id: l.id,
          at: l.createdAt,
          actorId: actor.id,
          actorName: actor.name,
          kind: 'SUBMITTED',
          text: updated
            ? `${actor.name} updated the Drive link for ${where}`
            : `${actor.name} submitted ${where} — ready for setup`,
          adsetId: row.adset.id,
        })
      }
      if (out.length >= limit) break
      continue
    }

    // Charles changing the instructions on a task that already exists — the setup
    // team needs to know the brief moved under them. (Instructions written at
    // creation ride on the task itself; the task appearing is the notification.)
    if (l.eventType === 'SETUP_INSTRUCTIONS_SET' && actor.role === 'MEDIA_BUYER') {
      const row = rowForSetupTask(db, l.entityId)
      if (!row) continue
      const text = typeof l.metadata?.instructions === 'string' ? l.metadata.instructions : ''
      out.push({
        id: l.id,
        at: l.createdAt,
        actorId: actor.id,
        actorName: actor.name,
        kind: 'INSTRUCTIONS',
        text: text
          ? `${actor.name} updated the instructions for ${row.adset.name} · ${row.campaign.name} — ${text}`
          : `${actor.name} removed the instructions for ${row.adset.name} · ${row.campaign.name}`,
        adsetId: row.adset.id,
      })
      if (out.length >= limit) break
      continue
    }

    if (!SETUP_EVENT_TYPES.has(l.eventType)) continue
    if (actor.role !== 'SETUP' && actor.role !== 'SETUP_QA') continue

    if (l.entityType === 'setup_task') {
      const row = rowForSetupTask(db, l.entityId)
      if (!row) continue
      const where = `${row.adset.name} · ${row.campaign.name}`
      const reason = typeof l.metadata?.reason === 'string' ? ` — ${l.metadata.reason}` : ''
      const kind: SetupEventKind =
        l.eventType === 'SETUP_COMPLETED'
          ? 'COMPLETED'
          : l.eventType === 'SETUP_BLOCKED'
            ? 'BLOCKED'
            : l.eventType === 'SETUP_UNBLOCKED'
              ? 'UNBLOCKED'
              : 'QA'
      const verb =
        kind === 'COMPLETED'
          ? 'launched'
          : kind === 'BLOCKED'
            ? 'raised a blocker on'
            : kind === 'UNBLOCKED'
              ? 'cleared the blocker on'
              : 'QA-checked'
      out.push({
        id: l.id,
        at: l.createdAt,
        actorId: actor.id,
        actorName: actor.name,
        kind,
        text: `${actor.name} ${verb} ${where}${kind === 'BLOCKED' ? reason : ''}`,
        adsetId: row.adset.id,
      })
    } else if (l.entityType === 'ad_account') {
      const acc = adAccount(db, l.entityId)
      if (!acc) continue
      const status = typeof l.metadata?.status === 'string' ? l.metadata.status : acc.status
      const reason = typeof l.metadata?.reason === 'string' ? ` — ${l.metadata.reason}` : ''
      out.push({
        id: l.id,
        at: l.createdAt,
        actorId: actor.id,
        actorName: actor.name,
        kind: 'ACCOUNT',
        text:
          status === 'ACTIVE'
            ? `${actor.name} marked ${acc.displayName} healthy`
            : `${actor.name} reported ${acc.displayName} as ${status.toLowerCase().replace('_', ' ')}${reason}`,
      })
    }
    if (out.length >= limit) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Ad-account directory

export interface AccountCampaign {
  campaign: Campaign
  used: number
  /** True when at least one ad set is ACTIVE — i.e. the CBO is live in Meta. */
  live: boolean
}

export interface AccountSummary {
  account: AdAccount
  countryCode: string
  campaigns: AccountCampaign[]
  /** Open setup + creative tasks whose destination is this account. */
  openTasks: number
  blocked: number
}

export function accountSummaries(db: Db): AccountSummary[] {
  const rows = allLaunchRows(db)
  return db.adAccounts
    .map((account) => {
      const country = byId(db.countries, account.countryId)
      const campaigns = campaignsInAccount(db, account.id).map((campaign) => {
        const sets = adsetsInCampaign(db, campaign.id)
        return {
          campaign,
          used: sets.filter((a) => OCCUPYING_STATUSES.includes(a.status)).length,
          live: sets.some((a) => a.status === 'ACTIVE'),
        }
      })
      const mine = rows.filter((r) => r.account.id === account.id)
      const openTasks =
        mine.filter((r) => r.setupTask && r.setupTask.status !== 'COMPLETED').length +
        mine.filter((r) => r.creativeTask && r.creativeTask.status === 'TODO').length
      const blocked = mine.filter((r) => r.setupTask?.blockedReason).length
      return { account, countryCode: country?.code ?? '', campaigns, openTasks, blocked }
    })
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.account.adAccountNumber.localeCompare(b.account.adAccountNumber))
}

/** Open work for one account, for the directory's "View tasks" drawer. */
export function accountOpenRows(db: Db, accountId: string): LaunchRow[] {
  return allLaunchRows(db).filter(
    (r) =>
      r.account.id === accountId &&
      ((r.setupTask && r.setupTask.status !== 'COMPLETED') ||
        (r.creativeTask && r.creativeTask.status === 'TODO')),
  )
}
