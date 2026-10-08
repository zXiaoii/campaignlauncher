// Data model — mirrors PRD §14 "Minimal Data Model" and §14.1 enums.
// Field names are camelCase here; the snake_case column names in the PRD map 1:1.

/**
 * STORE is the funnels-and-store seat: the person who keeps each product's
 * Funnelish funnel and Shopify listing working in every market it is advertised
 * in. Sees one screen — which products are live where — and nothing else.
 */
export type Role = 'CEO' | 'MEDIA_BUYER' | 'CREATIVE' | 'SETUP' | 'SETUP_QA' | 'STORE'

/** The two places a product has to be right before ads can sell it. */
export type StoreChannel = 'funnelish' | 'shopify'

/** One tick: who confirmed the channel is fine for a product in a market, and when. */
export interface StoreCheck {
  by: string
  at: string
}

/**
 * NEW / SWE / REL / DIT are the §4.1 codes the app generates names with. MAIN is
 * for campaigns imported from Meta with their existing "MAIN CBO …" names — it is
 * never offered when creating a CBO. TEST is the analyzer's "TEST ABO <product>"
 * campaign: one per product per account, a new ad set per test batch. It is not a
 * CBO, so the four-ad-set maximum does not apply and the Next batch trigger never
 * touches it — its batches come from an applied review.
 */
export type CampaignType = 'NEW' | 'SWE' | 'REL' | 'DIT' | 'MAIN' | 'TEST'

/** The verdict the ecom analyzer gives a campaign in its Meta Ads Review workbook. */
export type ReviewStatus = 'SCALE' | 'HOLD' | 'FIX' | 'KILL' | 'TESTING' | 'WATCH' | 'OFF'

/** The latest review of a campaign — replaced whole each time a review is applied. */
export interface CampaignReview {
  status: ReviewStatus
  /** Real (Shopify) numbers over the report period. */
  roas?: number
  spend?: number
  orders?: number
  /** The analyzer's "Actions" text for the campaign, verbatim. */
  actions?: string
  /** Report period, `YYYY-MM-DD`. */
  from: string
  to: string
  appliedAt: string
}

export type LaunchMode =
  | 'NEW_CREATIVE'
  | 'REUSE_EXACT'
  | 'REUSE_PLUS_NEW'
  | 'DEEP_ITERATION'
  /** Charles supplies the Drive link himself — no creative task, setup starts Ready. */
  | 'OWN_BATCH'

/**
 * Deliberately no "in progress" in either task model. A setup task is either
 * blocked on creative, ready, or done; a creative task is either open, handed
 * to setup, or done. Fewer states, nothing to forget to click.
 */
export type SetupStatus = 'WAITING_FOR_CREATIVE' | 'READY' | 'COMPLETED'

export type CreativeStatus = 'TODO' | 'SUBMITTED' | 'COMPLETED'

/** Charles's ordering hint for Yzah's queue. Sorts before due date. */
export type CreativePriority = 'LOW' | 'NORMAL' | 'HIGH'

export type AdsetStatus = 'PLANNED' | 'ACTIVE' | 'STOPPED' | 'KILLED' | 'ARCHIVED'

/** Creative framework. Drives both the brief preset and the ad-set concept label. */
export type ConceptType =
  | 'SWIPES_PLAYBOOK'
  /** Pure swipes: recreate the references as they are, no Playbook layer on top. */
  | 'SWIPES'
  | 'ITERATION'
  | 'DEEP_ITERATION'
  /** Same winning concept, different executions — new hooks, formats or visuals on it. */
  | 'VARIATION'
  | 'CUSTOM'

export interface User {
  /** Always `u_` + username — the auth layer derives it from the sign-in. */
  id: string
  username: string
  name: string
  role: Role
  /** Inactive people cannot sign in; their name stays on everything they did. */
  active: boolean
  /** Display order. IndexedDB returns rows in key order, so this has to be explicit. */
  sortOrder: number
  /**
   * Local backend only: salted SHA-256 of the password for people added through the
   * Team screen. On Firebase the account lives in Firebase Auth and this is unset.
   */
  passwordHash?: string
}

export interface Country {
  id: string
  code: string
  name: string
  sortOrder: number
}

/**
 * Account health. ACTIVE is the only state work should be queued into; the rest
 * are "problem" states with a reason — the thing Charles checks before planning
 * the next launch on an account, and the thing setup finds out first.
 */
export type AdAccountStatus =
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'IN_REVIEW'
  | 'DISABLED'
  | 'PAUSED'
  /** Banned, dead or no longer used. Hidden from the workspace, kept for history. */
  | 'OFFBOARDED'

export interface AdAccount {
  id: string
  countryId: string
  /** Exact supplier display name — used verbatim in setup copy blocks. */
  displayName: string
  /** Normalized leading numeric token — the only part used in campaign naming (§4.2). */
  adAccountNumber: string
  store?: string
  supplier?: string
  /** The supplier's own label for the account, e.g. "DGTL | UK | AD 1". */
  supplierRef?: string
  /** IANA timezone the account runs on, e.g. "Europe/London". */
  timezone?: string
  status: AdAccountStatus
  statusReason?: string
  statusChangedBy?: string
  statusChangedAt?: string
  /**
   * The account keeps running, but the team launches nothing new into it: every
   * CBO on it is off the Next batch trigger, exactly as if each were held one by
   * one. Healthy-or-not is a separate question (`status`).
   */
  onHold?: boolean
}

export interface Product {
  id: string
  name: string
  store?: string
  active: boolean
  /**
   * Funnelish / Shopify confirmations, per market (country id). Like Mark's QA
   * tick, these record that someone looked; nothing in the app waits on them.
   */
  storeChecks?: Record<string, Partial<Record<StoreChannel, StoreCheck>>>
}

export interface Campaign {
  id: string
  adAccountId: string
  productId: string
  /** Generated name, exactly as it exists in Meta. */
  name: string
  campaignType: CampaignType
  /**
   * KILLED: switched off in Meta for good. Leaves the workspace; its ad sets move
   * to the Library as killed, so their creative can still be brought back.
   */
  status: 'ACTIVE' | 'ARCHIVED' | 'KILLED'
  killedAt?: string
  killedBy?: string
  /**
   * Still running in Meta, but the team no longer launches new ad sets into it.
   * Next batch and the bulk trigger skip it; everything else (setup history,
   * relaunching its ads elsewhere) still works.
   */
  onHold?: boolean
  /** What the analyzer last said about it (Workspace → Apply review). */
  review?: CampaignReview
  createdAt: string
}

export interface Adset {
  id: string
  campaignId: string
  /** `MM/DD/YY <concept label>` — always the destination launch date (§4.4). */
  name: string
  conceptType: ConceptType
  conceptLabel: string
  /** Source lineage: set when this launch reused/relaunched/iterated an older ad set. */
  sourceAdsetId?: string
  /**
   * Unset for ad sets imported from Meta (no Drive folder in the app) and for
   * launches that relaunch such an ad set — setup duplicates the ads inside Meta,
   * guided by the setup task's `instructions`.
   */
  creativeBatchId?: string
  launchedAt?: string
  status: AdsetStatus
}

export interface CreativeReference {
  url: string
  label?: string
}

export interface CreativeBatch {
  id: string
  productId: string
  type: ConceptType
  hooks: string[]
  angle?: string
  direction?: string
  references: CreativeReference[]
  /** Who last wrote the brief after the launch was created (Charles or Mark), and when. */
  briefUpdatedBy?: string
  briefUpdatedAt?: string
  driveUrl?: string
  originalLaunchId?: string
  createdAt: string
}

export interface Launch {
  id: string
  launchMode: LaunchMode
  sourceAdsetId?: string
  sourceBatchId?: string
  destinationCampaignId: string
  destinationAdsetId: string
  createdBy: string
  deadline?: string
  launchedAt?: string
  status: 'PLANNED' | 'LAUNCHED'
}

export interface CreativeTask {
  id: string
  /**
   * Empty while the task belongs to a queued product (see ProductLaunch): Yzah has
   * the work before anyone has picked the ad account. Set when setup places it.
   */
  launchId: string
  productLaunchId?: string
  assignee: string
  creativeBatchId: string
  quantity: number
  priority: CreativePriority
  status: CreativeStatus
  dueAt: string
  submittedAt?: string
  /** Who handed it in — Yzah, or Mark as the second creative. Unset on older rows. */
  submittedBy?: string
  submissionNote?: string
  /**
   * Yzah's channel back to Charles: "need more references", "source Drive is
   * empty", etc. Free text; Charles sees it as a flag on the task and clears it.
   */
  requestNote?: string
  requestAt?: string
}

export interface SetupTask {
  id: string
  launchId: string
  status: SetupStatus
  creativeRequired: boolean
  /**
   * No pre-assignment: Karl and Christian share one queue and sort it out between
   * themselves. Whoever completes the task is recorded here — that is the "setup
   * person" Danny and Mark see (§12.5, §11.1).
   */
  completedBy?: string
  completedAt?: string
  dueAt: string

  /**
   * Charles's typed instructions for this launch — "just use the 09/18/26 swipes
   * and relaunch it here", "duplicate the top 3 ads only", anything. Free text,
   * shown at the top of the setup task and in the copy block. Editable by Charles
   * until setup completes.
   */
  instructions?: string
  instructionsAt?: string

  /**
   * Blocker raised by the setup team — a BM restriction, a disabled account,
   * a missing payment method. Orthogonal to status: a Ready task can be blocked.
   * Cleared explicitly, or automatically on completion.
   */
  blockedReason?: string
  blockedBy?: string
  blockedAt?: string

  /**
   * Mark's QA marker (§11.2). NON-BLOCKING BY CONTRACT: no status transition, no
   * launch, and no task in this app reads these three fields to decide whether
   * work may proceed. They record that a human looked, nothing more. If you ever
   * find yourself gating on `checkedAt`, that is the bug.
   */
  checkedBy?: string
  checkedAt?: string
  checkNote?: string
}

/**
 * A new product Charles wants launched, before anyone knows which ad account it
 * goes in. It sits in the "New products to launch" container until someone on the
 * setup team places it: picks the account, and the app creates the CBO, the ad set,
 * the launch and the tasks from what Charles wrote here — exactly as if Charles had
 * launched it into that account himself.
 */
export interface ProductLaunch {
  id: string
  productName: string
  countryId: string
  /** Charles's note to setup — offer, landing page, anything. Goes on the setup task. */
  instructions?: string
  /** Where the creatives come from: a Drive folder Charles has, or Yzah makes them. */
  creative:
    | { kind: 'OWN_DRIVE'; driveUrl: string }
    | { kind: 'NEW'; quantity: number; angle?: string; direction?: string; references: CreativeReference[] }
  conceptType: ConceptType
  priority: CreativePriority
  /** When Yzah makes the creatives: her batch and task, created the moment Charles queues it. */
  creativeBatchId?: string
  creativeTaskId?: string
  createdBy: string
  createdAt: string
  status: 'OPEN' | 'PLACED'
  placedBy?: string
  placedAt?: string
  adAccountId?: string
  campaignId?: string
  launchId?: string
}

export interface Followup {
  id: string
  sourceAdsetId: string
  eligibleAt: string
  status: 'OPEN' | 'DISMISSED' | 'ACTIONED'
}

export interface ActivityLog {
  id: string
  userId: string
  entityType: string
  entityId: string
  eventType: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface Db {
  users: User[]
  countries: Country[]
  adAccounts: AdAccount[]
  products: Product[]
  campaigns: Campaign[]
  adsets: Adset[]
  creativeBatches: CreativeBatch[]
  launches: Launch[]
  creativeTasks: CreativeTask[]
  setupTasks: SetupTask[]
  followups: Followup[]
  productLaunches: ProductLaunch[]
  activityLogs: ActivityLog[]
}
