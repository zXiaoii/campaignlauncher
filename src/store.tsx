// Application state + every mutation.
//
// This is the prototype's stand-in for the API layer, and it is where the
// non-negotiable rules live (§1.4) — not in the components. The 3-ad-set maximum
// and the role checks are enforced here, so a hidden button is never the only
// thing stopping an illegal write (§2.3).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { clearSession, getSession, saveSession } from './auth'
import { now } from './clock'
import { loadDatabase, onRemoteChange, persistChanges, resetDatabase } from './db'
import { PLACEHOLDER_ADSET_NAME } from './importing'
import { SignIn } from './screens/SignIn'
import {
  buildAdsetName,
  buildCampaignName,
  CONCEPT_LABELS,
  dedupeCampaignName,
  DEFAULT_DIRECTION,
  extractAdAccountNumber,
  MAX_ADSETS_PER_CAMPAIGN,
  parseDateInput,
  toDateInputValue,
} from './naming'
import { assertCanWrite } from './permissions'
import {
  adAccount,
  adset,
  batch,
  campaign,
  campaignsInAccount,
  hasAdsetNamed,
  isCampaignFull,
  plannedAdsets,
  slotsUsed,
} from './selectors'
import type {
  AdAccountStatus,
  CampaignType,
  ConceptType,
  CreativePriority,
  CreativeReference,
  Db,
  LaunchMode,
  Role,
  User,
} from './types'

// ---------------------------------------------------------------------------

export class LaunchRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LaunchRuleError'
  }
}

/** The four creative-handling options that require Yzah to do new work (§6.3). */
const CREATIVE_REQUIRED: LaunchMode[] = [
  'NEW_CREATIVE',
  'REUSE_PLUS_NEW',
  'DEEP_ITERATION',
]

export function requiresCreative(mode: LaunchMode): boolean {
  return CREATIVE_REQUIRED.includes(mode)
}

export type SourceKind =
  | 'NEW_BATCH'
  | 'EXISTING_BATCH'
  | 'EXISTING_ADSET'
  | 'OLD_ADSET'
  /** Charles already has the creatives in a Drive folder of his own. */
  | 'OWN_DRIVE'

export interface Brief {
  hooks: string[]
  angle: string
  direction: string
  references: CreativeReference[]
  quantity: number
  priority: CreativePriority
}

export type Destination =
  | { kind: 'EXISTING_CAMPAIGN'; campaignId: string }
  /**
   * A new CBO names its product freely: `productName` is what Charles typed. It is
   * matched to an existing product case-insensitively, or created on the spot.
   */
  | { kind: 'NEW_CAMPAIGN'; campaignType: CampaignType; productName: string }

/** Existing product for a typed name, if any (case- and whitespace-insensitive). */
export function findProductByName(db: Db, name: string) {
  const wanted = name.trim().toLowerCase()
  return wanted ? db.products.find((p) => p.name.trim().toLowerCase() === wanted) : undefined
}

export interface CreateLaunchInput {
  sourceKind: SourceKind
  sourceAdsetId?: string
  sourceBatchId?: string
  creativeHandling: LaunchMode
  adAccountId: string
  destination: Destination
  conceptType: ConceptType
  conceptLabel: string
  /** `YYYY-MM-DD`. The destination ad-set name is generated from this (§4.4). */
  launchDate: string
  brief: Brief
  /** Required when `creativeHandling` is OWN_BATCH: the Drive folder Charles made. */
  ownDriveUrl?: string
  /** Free-text instructions for the setup team, stored on the setup task. */
  setupInstructions?: string
  setupDueAt: string
  creativeDueAt: string
}

/** One ad set as it already runs in Meta — see `importing.ts` for how a line becomes this. */
export interface ImportedAdsetInput {
  name: string
  launchedAt?: string
  conceptType: ConceptType
  conceptLabel: string
}

export interface CampaignImportInput {
  adAccountId: string
  /** Add to this CBO; when unset a new campaign is created from the fields below. */
  campaignId?: string
  name?: string
  productName?: string
  campaignType?: CampaignType
  adsets: ImportedAdsetInput[]
}

export interface NamePreview {
  accountDisplayName: string
  campaignName: string
  adsetName: string
  isNewCampaign: boolean
  slotsAfter: number
  blocked?: string
  /** Account is in a problem state. Charles may still launch; he should know. */
  warning?: string
}

let seq = 0
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${seq++}`

// ---------------------------------------------------------------------------
// Naming preview — the same code path the mutation uses, so what Charles reviews
// in §15.3 is exactly what gets created.

export function previewNames(db: Db, input: CreateLaunchInput): NamePreview {
  const acc = adAccount(db, input.adAccountId)
  const blank: NamePreview = {
    accountDisplayName: acc?.displayName ?? '—',
    campaignName: '—',
    adsetName: '—',
    isNewCampaign: false,
    slotsAfter: 0,
  }
  if (!acc) return { ...blank, blocked: 'Select a destination ad account.' }
  if (!acc.adAccountNumber) {
    return {
      ...blank,
      blocked: `No ad account number extracted from "${acc.displayName}". Correct it before launching.`,
    }
  }

  const adsetName = input.conceptLabel.trim()
    ? buildAdsetName(parseDateInput(input.launchDate), input.conceptLabel)
    : '—'
  const warning =
    acc.status !== 'ACTIVE'
      ? `${acc.displayName} is ${acc.status.toLowerCase().replace('_', ' ')}${acc.statusReason ? ` — ${acc.statusReason}` : ''}. Setup may not be able to publish.`
      : undefined

  if (input.destination.kind === 'EXISTING_CAMPAIGN') {
    const cm = campaign(db, input.destination.campaignId)
    if (!cm) return { ...blank, adsetName, warning, blocked: 'Select a destination CBO.' }
    const used = slotsUsed(db, cm.id)
    const blocked =
      used >= MAX_ADSETS_PER_CAMPAIGN
        ? `${cm.name} is already ${used}/${MAX_ADSETS_PER_CAMPAIGN}. Create a new CBO with this source instead.`
        : adsetName !== '—' && hasAdsetNamed(db, cm.id, adsetName)
          ? `${cm.name} already has an ad set named "${adsetName}". Change the label so the names stay unique in Meta.`
          : undefined
    return {
      accountDisplayName: acc.displayName,
      campaignName: cm.name,
      adsetName,
      isNewCampaign: false,
      slotsAfter: used + 1,
      blocked,
      warning,
    }
  }

  const typed = input.destination.productName.trim()
  if (!typed) return { ...blank, adsetName, warning, blocked: 'Type the product.' }
  const prod = findProductByName(db, typed)
  const base = buildCampaignName(
    input.destination.campaignType,
    prod?.name ?? typed,
    acc.adAccountNumber,
  )
  const existing = campaignsInAccount(db, acc.id).map((c) => c.name)
  return {
    accountDisplayName: acc.displayName,
    campaignName: dedupeCampaignName(base, existing),
    adsetName,
    isNewCampaign: true,
    slotsAfter: 1,
  }
}

// ---------------------------------------------------------------------------
// Reducer

type Action =
  | { type: 'CREATE_LAUNCH'; input: CreateLaunchInput; actorId: string }
  /**
   * One click: a fresh creative batch into each CBO, shaped by that CBO's most
   * recent active ad set. Atomic: if any campaign is full, nothing is created.
   */
  | { type: 'NEXT_BATCH'; campaignIds: string[]; actorId: string }
  /**
   * Undo a launch that has not gone live: removes the planned ad set, the launch,
   * both tasks, and the creative batch if nothing else uses it.
   */
  | { type: 'LAUNCH_CANCEL'; adsetId: string; actorId: string }
  | {
      type: 'CREATIVE_SUBMIT'
      taskId: string
      driveUrl: string
      note?: string
      actorId: string
    }
  | {
      type: 'CREATIVE_SET_PRIORITY'
      taskId: string
      priority: CreativePriority
      actorId: string
    }
  /** Yzah's note back to Charles. Empty note clears it. */
  | { type: 'CREATIVE_SET_REQUEST'; taskId: string; note?: string; actorId: string }
  /** Setup raises (reason) or clears (no reason) a blocker. */
  | { type: 'SETUP_SET_BLOCKER'; taskId: string; reason?: string; actorId: string }
  /** Charles rewrites (or clears) the instructions on a setup task that is not live yet. */
  | { type: 'SETUP_SET_INSTRUCTIONS'; taskId: string; instructions?: string; actorId: string }
  /**
   * Bring a CBO that already runs in Meta into the workspace — or add its ad sets to
   * one that is here already. Nothing else is touched, so this is safe on the live
   * database at any time (unlike Reset data).
   */
  | ({ type: 'CAMPAIGN_IMPORT'; actorId: string } & CampaignImportInput)
  /** Several CBOs from one Meta export, all or nothing. */
  | { type: 'CAMPAIGN_IMPORT_MANY'; items: CampaignImportInput[]; actorId: string }
  /** "We don't produce ad sets here anymore" — Next batch skips the CBO until resumed. */
  | { type: 'CAMPAIGN_SET_HOLD'; campaignId: string; onHold: boolean; actorId: string }
  | { type: 'SETUP_COMPLETE'; taskId: string; actorId: string }
  | {
      type: 'ACCOUNT_CREATE'
      countryId: string
      displayName: string
      adAccountNumber?: string
      store?: string
      supplier?: string
      actorId: string
    }
  | {
      type: 'ACCOUNT_SET_STATUS'
      accountId: string
      status: AdAccountStatus
      reason?: string
      actorId: string
    }
  | {
      type: 'USER_CREATE'
      name: string
      username: string
      role: Role
      /** Local backend: hash of the chosen password. Firebase: undefined. */
      passwordHash?: string
      actorId: string
    }
  | { type: 'USER_SET_ACTIVE'; userId: string; active: boolean; actorId: string }
  | {
      type: 'SETUP_SET_CHECK'
      taskId: string
      checked: boolean
      note?: string
      actorId: string
    }
  | { type: 'FOLLOWUP_DISMISS'; sourceAdsetId: string; actorId: string }
  | { type: 'ADSET_ARCHIVE'; adsetId: string; actorId: string }
  | { type: 'ACCOUNT_SET_NUMBER'; accountId: string; number: string; actorId: string }
  /** Wholesale replacement, used by "Reset data" after the local DB is reseeded. */
  | { type: 'REPLACE'; db: Db }

function log(
  db: Db,
  actorId: string,
  entityType: string,
  entityId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  db.activityLogs = [
    ...db.activityLogs,
    {
      id: nextId('log'),
      userId: actorId,
      entityType,
      entityId,
      eventType,
      metadata,
      createdAt: now().toISOString(),
    },
  ]
}

/** What "Next batch" will do for a CBO — shown as the button tooltip and used to build it. */
export interface NextBatchPlan {
  campaign: NonNullable<ReturnType<typeof campaign>>
  /** The ad set the new batch is modelled on, if the CBO has launched anything. */
  source?: Db['adsets'][number]
  conceptType: ConceptType
  conceptLabel: string
  quantity: number
  adsetName: string
  input: CreateLaunchInput
  /**
   * Why the button is off, when it is. Checked in order: the account is off-boarded;
   * the CBO is full; a previous batch is still planned (one in flight per CBO — this
   * is what stops a spammed click from queueing four identical batches); or an ad
   * set with today's generated name already exists.
   */
  blockedReason?: string
  /** Non-blocking: the account has a problem. Shown, never enforced. */
  warning?: string
}

/**
 * Derives a complete launch from a CBO's most recent active ad set: same
 * framework and concept label, same creative quantity as last time, the source
 * Drive/direction attached to Yzah's brief through the normal lineage path.
 * Falls back to the most recently launched ad set of any status, and to a plain
 * Swipes + Playbook batch if the CBO has never launched.
 */
export function planNextBatch(db: Db, campaignId: string, at: Date): NextBatchPlan {
  const cm = campaign(db, campaignId)
  if (!cm) throw new LaunchRuleError('Campaign not found.')

  const launched = db.adsets
    .filter((a) => a.campaignId === campaignId && a.launchedAt)
    .sort((a, b) => (a.launchedAt! < b.launchedAt! ? 1 : -1))
  const source = launched.find((a) => a.status === 'ACTIVE') ?? launched[0]

  // An imported "existing ads" placeholder has no framework to copy — the next
  // batch after it is the PRD default, Swipes + Playbook.
  const conceptType =
    source && source.conceptType !== 'CUSTOM' ? source.conceptType : 'SWIPES_PLAYBOOK'
  const conceptLabel =
    source && source.conceptType !== 'CUSTOM'
      ? source.conceptLabel || CONCEPT_LABELS[conceptType]
      : CONCEPT_LABELS.SWIPES_PLAYBOOK

  const sourceLaunch = source
    ? db.launches.find((l) => l.destinationAdsetId === source.id)
    : undefined
  const lastTask = sourceLaunch
    ? db.creativeTasks.find((t) => t.launchId === sourceLaunch.id)
    : undefined
  const quantity = lastTask?.quantity ?? 8

  // Deadlines: noon / 6pm today, pushed out if the day is already past them.
  const dueAt = (hour: number, minHours: number) => {
    const d = new Date(at)
    d.setHours(hour, 0, 0, 0)
    const floor = new Date(at.getTime() + minHours * 3_600_000)
    return (d > floor ? d : floor).toISOString()
  }

  const launchDate = toDateInputValue(at)
  const input: CreateLaunchInput = {
    sourceKind: source ? 'EXISTING_ADSET' : 'NEW_BATCH',
    sourceAdsetId: source?.id,
    creativeHandling: 'NEW_CREATIVE',
    adAccountId: cm.adAccountId,
    destination: { kind: 'EXISTING_CAMPAIGN', campaignId },
    conceptType,
    conceptLabel,
    launchDate,
    brief: {
      // §8.4 — hooks and references are never carried over silently. The source
      // Drive is attached as a reference by CREATE_LAUNCH; direction falls back to
      // the source's when the framework has no preset text.
      hooks: [],
      angle: '',
      direction: DEFAULT_DIRECTION[conceptType],
      references: [],
      quantity,
      priority: 'NORMAL',
    },
    creativeDueAt: dueAt(12, 3),
    setupDueAt: dueAt(18, 6),
  }

  const adsetName = buildAdsetName(parseDateInput(launchDate), conceptLabel)
  const inFlight = plannedAdsets(db, campaignId)
  const acc = adAccount(db, cm.adAccountId)
  // Only an off-boarded account blocks the trigger — that account is gone. A
  // problem (restricted, in review, spend cap) is a warning: creative can still be
  // queued while the account is sorted out; setup sees the account callout.
  const blockedReason =
    acc && acc.status === 'OFFBOARDED'
      ? `${acc.displayName} is off-boarded.`
      : cm.onHold
        ? `${cm.name} is on hold — no new ad sets go into it. Resume it from the card menu first.`
      : isCampaignFull(db, campaignId)
        ? `${cm.name} is full.`
        : inFlight.length > 0
          ? `${inFlight[0].name} has not launched yet — one batch in flight per CBO.`
          : hasAdsetNamed(db, campaignId, adsetName)
            ? `${cm.name} already has an ad set named "${adsetName}" today.`
            : undefined
  const warning =
    acc && acc.status !== 'ACTIVE' && acc.status !== 'OFFBOARDED'
      ? `${acc.displayName} is ${acc.status.toLowerCase().replace('_', ' ')}${acc.statusReason ? ` — ${acc.statusReason}` : ''}. Setup may not be able to publish until it is healthy.`
      : undefined

  return {
    warning,
    campaign: cm,
    source,
    conceptType,
    conceptLabel,
    quantity,
    adsetName,
    input,
    blockedReason,
  }
}

function reducer(state: Db, action: Action): Db {
  if (action.type === 'REPLACE') return action.db

  // Composite action: run the single-launch path once per campaign against the
  // accumulating state, so each launch sees the slots the previous one took.
  if (action.type === 'NEXT_BATCH') {
    const actor = state.users.find((u) => u.id === action.actorId)
    assertCanWrite(actor?.role ?? 'CREATIVE', 'createLaunch')
    if (action.campaignIds.length === 0) throw new LaunchRuleError('No campaign to launch into.')
    const at = now()
    let next = state
    for (const id of action.campaignIds) {
      if (!campaign(next, id)) throw new LaunchRuleError('That campaign no longer exists.')
      const plan = planNextBatch(next, id, at)
      if (plan.blockedReason) {
        throw new LaunchRuleError(`${plan.blockedReason} Nothing was created.`)
      }
      next = reducer(next, { type: 'CREATE_LAUNCH', input: plan.input, actorId: action.actorId })
    }
    const out: Db = { ...next }
    log(out, action.actorId, 'launch', 'batch', 'NEXT_BATCH', {
      campaigns: action.campaignIds.length,
    })
    return out
  }

  if (action.type === 'CAMPAIGN_IMPORT_MANY') {
    if (action.items.length === 0) throw new LaunchRuleError('Nothing selected to add.')
    let next = state
    for (const item of action.items) {
      next = reducer(next, { type: 'CAMPAIGN_IMPORT', ...item, actorId: action.actorId })
    }
    const out: Db = { ...next }
    log(out, action.actorId, 'campaign', 'batch', 'CAMPAIGNS_IMPORTED', { campaigns: action.items.length })
    return out
  }

  const db: Db = { ...state }
  const actor = state.users.find((u) => u.id === action.actorId)
  const role: Role = actor?.role ?? 'CREATIVE'

  switch (action.type) {
    // -----------------------------------------------------------------------
    case 'CREATE_LAUNCH': {
      assertCanWrite(role, 'createLaunch')
      const input = action.input
      const acc = adAccount(state, input.adAccountId)
      if (!acc) throw new LaunchRuleError('Destination ad account not found.')
      if (!acc.adAccountNumber) {
        throw new LaunchRuleError(
          'Ad account has no normalized account number. Correct it before launching.',
        )
      }

      // -- destination campaign: resolve or create -------------------------
      let campaignId: string
      if (input.destination.kind === 'EXISTING_CAMPAIGN') {
        const cm = campaign(state, input.destination.campaignId)
        if (!cm) throw new LaunchRuleError('Destination CBO not found.')
        campaignId = cm.id
      } else {
        const typed = input.destination.productName.trim()
        if (!typed) throw new LaunchRuleError('Type the product for the new CBO.')
        // Reuse the product if it exists (by name, any casing); otherwise it is a
        // new product and gets created here so the directory and filters know it.
        let prod = findProductByName(state, typed)
        if (!prod) {
          prod = { id: nextId('p'), name: typed, active: true }
          db.products = [...state.products, prod]
        }
        const base = buildCampaignName(
          input.destination.campaignType,
          prod.name,
          acc.adAccountNumber,
        )
        const name = dedupeCampaignName(
          base,
          campaignsInAccount(state, acc.id).map((c) => c.name),
        )
        campaignId = nextId('cm')
        db.campaigns = [
          ...state.campaigns,
          {
            id: campaignId,
            adAccountId: acc.id,
            productId: prod.id,
            name,
            campaignType: input.destination.campaignType,
            status: 'ACTIVE',
            createdAt: now().toISOString(),
          },
        ]
      }

      // -- HARD RULE §1.4: never a fourth ad set ---------------------------
      const dbWithCampaign: Db = { ...db, campaigns: db.campaigns ?? state.campaigns }
      if (isCampaignFull(dbWithCampaign, campaignId)) {
        const cm = campaign(dbWithCampaign, campaignId)
        throw new LaunchRuleError(
          `${cm?.name ?? 'This CBO'} already has ${MAX_ADSETS_PER_CAMPAIGN} ad sets. Create a new CBO with this source.`,
        )
      }

      // -- creative batch --------------------------------------------------
      const creativeNeeded = requiresCreative(input.creativeHandling)
      const sourceBatchId =
        input.sourceBatchId ?? adset(state, input.sourceAdsetId)?.creativeBatchId
      let batchId: string | undefined
      const newBatches = [...state.creativeBatches]
      const prodId = campaign(dbWithCampaign, campaignId)!.productId

      if (input.creativeHandling === 'OWN_BATCH') {
        // Charles made the creatives himself. The batch is complete on arrival —
        // Drive link included — so setup is Ready at once and Yzah gets nothing.
        const url = input.ownDriveUrl?.trim()
        if (!url) throw new LaunchRuleError('Paste the Drive link for your batch.')
        batchId = nextId('cb')
        newBatches.push({
          id: batchId,
          productId: prodId,
          type: input.conceptType,
          hooks: input.brief.hooks,
          angle: input.brief.angle || undefined,
          direction: input.brief.direction || undefined,
          references: input.brief.references,
          driveUrl: url,
          createdAt: now().toISOString(),
        })
      } else if (input.creativeHandling === 'REUSE_EXACT') {
        // Reusing an ad set that was imported from Meta has no batch to point at:
        // the ads only exist inside Meta, so setup duplicates them there, guided
        // by the instructions. The launch still records the source for lineage.
        if (!sourceBatchId && !adset(state, input.sourceAdsetId)) {
          throw new LaunchRuleError('Exact reuse needs a source ad set or creative batch.')
        }
        batchId = sourceBatchId
      } else {
        // New work: a fresh batch. For reuse+new and deep iteration the source
        // Drive link and original direction ride along as references (§7.3, §7.4).
        const src = batch(state, sourceBatchId)
        const references = [...input.brief.references]
        // The source Drive rides along only when the brief is *about* the source —
        // deep iteration or adding to a batch. A fresh batch keeps lineage but not
        // the reference (§7.3, §7.4).
        const buildsOnSource =
          input.creativeHandling === 'DEEP_ITERATION' || input.creativeHandling === 'REUSE_PLUS_NEW'
        if (src?.driveUrl && buildsOnSource) {
          references.unshift({
            url: src.driveUrl,
            label: `Source batch — ${src.type === 'CUSTOM' ? 'custom' : CONCEPT_LABELS[src.type]}`,
          })
        }
        batchId = nextId('cb')
        newBatches.push({
          id: batchId,
          productId: prodId,
          type: input.conceptType,
          hooks: input.brief.hooks,
          angle: input.brief.angle || undefined,
          direction: input.brief.direction || src?.direction,
          references,
          driveUrl: undefined,
          createdAt: now().toISOString(),
        })
      }
      db.creativeBatches = newBatches

      // -- destination ad set: always the *new* launch date (§4.4 hard rule) --
      const adsetId = nextId('as')
      const adsetName = buildAdsetName(
        parseDateInput(input.launchDate),
        input.conceptLabel,
      )
      // HARD RULE: ad-set names are unique within a CBO. They are copied into Meta
      // verbatim; two identical ones would be indistinguishable there.
      if (hasAdsetNamed(dbWithCampaign, campaignId, adsetName)) {
        throw new LaunchRuleError(
          `${campaign(dbWithCampaign, campaignId)?.name} already has an ad set named "${adsetName}". Change the label.`,
        )
      }
      db.adsets = [
        ...state.adsets,
        {
          id: adsetId,
          campaignId,
          name: adsetName,
          conceptType: input.conceptType,
          conceptLabel: input.conceptLabel,
          sourceAdsetId: input.sourceAdsetId,
          creativeBatchId: batchId,
          status: 'PLANNED',
        },
      ]

      const launchId = nextId('ln')
      db.launches = [
        ...state.launches,
        {
          id: launchId,
          launchMode: input.creativeHandling,
          sourceAdsetId: input.sourceAdsetId,
          sourceBatchId:
            input.creativeHandling === 'REUSE_EXACT' ? batchId : sourceBatchId,
          destinationCampaignId: campaignId,
          destinationAdsetId: adsetId,
          createdBy: action.actorId,
          deadline: input.setupDueAt,
          status: 'PLANNED',
        },
      ]

      // -- tasks (§6.6) ----------------------------------------------------
      if (creativeNeeded && batchId) {
        db.creativeTasks = [
          ...state.creativeTasks,
          {
            id: nextId('ct'),
            launchId,
            assignee: 'u_yzah', // §6.5 — creative assignee is fixed to Yzah
            creativeBatchId: batchId,
            quantity: input.brief.quantity,
            priority: input.brief.priority,
            status: 'TODO',
            dueAt: input.creativeDueAt,
          },
        ]
      }
      const instructions = input.setupInstructions?.trim() || undefined
      db.setupTasks = [
        ...state.setupTasks,
        {
          id: nextId('st'),
          launchId,
          status: creativeNeeded ? 'WAITING_FOR_CREATIVE' : 'READY',
          creativeRequired: creativeNeeded,
          dueAt: input.setupDueAt,
          instructions,
          instructionsAt: instructions ? now().toISOString() : undefined,
        },
      ]

      log(db, action.actorId, 'launch', launchId, 'LAUNCH_CREATED', {
        mode: input.creativeHandling,
        campaignName: campaign(db, campaignId)?.name,
        adsetName,
        sourceAdsetId: input.sourceAdsetId,
        instructions,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'CAMPAIGN_IMPORT': {
      assertCanWrite(role, 'createLaunch')
      const acc = adAccount(state, action.adAccountId)
      if (!acc) throw new LaunchRuleError('Pick the ad account the CBO runs in.')

      let campaignId: string
      let campaignName: string
      if (action.campaignId) {
        const cm = campaign(state, action.campaignId)
        if (!cm || cm.adAccountId !== acc.id) throw new LaunchRuleError('That CBO is not in this ad account.')
        campaignId = cm.id
        campaignName = cm.name
      } else {
        const name = action.name?.trim() ?? ''
        if (!name) throw new LaunchRuleError('Type the campaign name exactly as it is in Meta.')
        if (campaignsInAccount(state, acc.id).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          throw new LaunchRuleError(`${acc.displayName} already has a CBO named "${name}".`)
        }
        const typed = action.productName?.trim() ?? ''
        if (!typed) throw new LaunchRuleError('Type the product.')
        let prod = findProductByName(state, typed)
        if (!prod) {
          prod = { id: nextId('p'), name: typed, active: true }
          db.products = [...state.products, prod]
        }
        campaignId = nextId('cm')
        campaignName = name
        db.campaigns = [
          ...state.campaigns,
          {
            id: campaignId,
            adAccountId: acc.id,
            productId: prod.id,
            name,
            campaignType: action.campaignType ?? 'MAIN',
            status: 'ACTIVE',
            createdAt: now().toISOString(),
          },
        ]
      }

      // Real ad sets replace the "existing ads" stand-in, exactly as they do in the seed.
      const incoming = action.adsets.map((a) => ({ ...a, name: a.name.trim() })).filter((a) => a.name)
      let adsets = state.adsets
      if (incoming.length > 0) {
        adsets = adsets.filter(
          (a) => !(a.campaignId === campaignId && a.name === PLACEHOLDER_ADSET_NAME && !a.launchedAt),
        )
      }
      const current = adsets.filter((a) => a.campaignId === campaignId)
      const names = new Set(current.map((a) => a.name))
      for (const a of incoming) {
        if (names.has(a.name)) throw new LaunchRuleError(`${campaignName} already has an ad set named "${a.name}".`)
        names.add(a.name)
      }
      // No four-slot check here: these ad sets already exist in Meta. A legacy CBO
      // with more than four simply shows as full, so nothing new can go into it.

      const toAdd: Db['adsets'] =
        incoming.length > 0
          ? incoming.map((a) => ({
              id: nextId('as'),
              campaignId,
              name: a.name,
              conceptType: a.conceptType,
              conceptLabel: a.conceptLabel,
              launchedAt: a.launchedAt,
              status: 'ACTIVE' as const,
            }))
          : current.length === 0
            ? [
                {
                  id: nextId('as'),
                  campaignId,
                  name: PLACEHOLDER_ADSET_NAME,
                  conceptType: 'CUSTOM' as const,
                  conceptLabel: PLACEHOLDER_ADSET_NAME,
                  status: 'ACTIVE' as const,
                },
              ]
            : []
      db.adsets = [...adsets, ...toAdd]

      log(db, action.actorId, 'campaign', campaignId, 'CAMPAIGN_IMPORTED', {
        campaignName,
        adsets: toAdd.map((a) => a.name),
        created: !action.campaignId,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'CAMPAIGN_SET_HOLD': {
      assertCanWrite(role, 'createLaunch')
      const cm = campaign(state, action.campaignId)
      if (!cm) throw new LaunchRuleError('Campaign not found.')
      db.campaigns = state.campaigns.map((c) =>
        c.id === cm.id ? { ...c, onHold: action.onHold || undefined } : c,
      )
      log(db, action.actorId, 'campaign', cm.id, action.onHold ? 'CAMPAIGN_HELD' : 'CAMPAIGN_RESUMED', {
        campaignName: cm.name,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'SETUP_SET_INSTRUCTIONS': {
      assertCanWrite(role, 'createLaunch')
      const task = state.setupTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Setup task not found.')
      if (task.status === 'COMPLETED') {
        throw new LaunchRuleError('This launch is already live — the instructions are locked.')
      }
      const instructions = action.instructions?.trim() || undefined
      const stamp = now().toISOString()
      db.setupTasks = state.setupTasks.map((t) =>
        t.id === task.id
          ? { ...t, instructions, instructionsAt: instructions ? stamp : undefined }
          : t,
      )
      log(db, action.actorId, 'setup_task', task.id, 'SETUP_INSTRUCTIONS_SET', {
        instructions,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'LAUNCH_CANCEL': {
      assertCanWrite(role, 'createLaunch')
      const target = adset(state, action.adsetId)
      if (!target) throw new LaunchRuleError('Ad set not found.')
      if (target.status !== 'PLANNED') {
        throw new LaunchRuleError('Only a planned launch can be cancelled. Live ad sets are archived instead.')
      }
      const launch = state.launches.find((l) => l.destinationAdsetId === target.id)

      db.adsets = state.adsets.filter((a) => a.id !== target.id)
      db.launches = state.launches.filter((l) => l.id !== launch?.id)
      db.creativeTasks = state.creativeTasks.filter((t) => t.launchId !== launch?.id)
      db.setupTasks = state.setupTasks.filter((t) => t.launchId !== launch?.id)
      db.followups = state.followups.filter((f) => f.sourceAdsetId !== target.id)

      // The batch this launch created (never a reused one) goes too, if nothing else
      // points at it. A batch with a Drive link has been worked on — Yzah submitted
      // it, or Charles supplied it — so it stays in the Library for reuse.
      const batchId = target.creativeBatchId
      const created = batchId ? batch(state, batchId) : undefined
      const stillUsed = db.adsets.some((a) => a.creativeBatchId === batchId)
      if (created && !created.driveUrl && !stillUsed && launch?.launchMode !== 'REUSE_EXACT') {
        db.creativeBatches = state.creativeBatches.filter((b) => b.id !== batchId)
      }

      log(db, action.actorId, 'launch', launch?.id ?? target.id, 'LAUNCH_CANCELLED', {
        adsetName: target.name,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'CREATIVE_SET_PRIORITY': {
      // Charles's call, not Yzah's — priority is how work is handed over, not a
      // status the assignee edits.
      assertCanWrite(role, 'editBrief')
      const task = state.creativeTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Creative task not found.')
      db.creativeTasks = state.creativeTasks.map((t) =>
        t.id === task.id ? { ...t, priority: action.priority } : t,
      )
      log(db, action.actorId, 'creative_task', task.id, 'CREATIVE_PRIORITY_SET', {
        priority: action.priority,
      })
      return db
    }

    case 'CREATIVE_SUBMIT': {
      // First submission and later edits go through the same path: Yzah can
      // correct the Drive link or note any time until setup has completed the
      // launch — after that the ads are live and the record is locked.
      assertCanWrite(role, 'submitCreative')
      const task = state.creativeTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Creative task not found.')
      if (task.status === 'COMPLETED') {
        throw new LaunchRuleError('Setup has already completed this launch — the submission is locked.')
      }
      if (!action.driveUrl.trim()) {
        throw new LaunchRuleError('A Google Drive link is required to submit.')
      }
      const isUpdate = task.status === 'SUBMITTED'
      const stamp = now().toISOString()
      db.creativeTasks = state.creativeTasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'SUBMITTED',
              submittedAt: stamp,
              submissionNote: action.note?.trim() || undefined,
            }
          : t,
      )
      // The batch — not the task — holds the Drive link, so it stays reusable (§7.1).
      db.creativeBatches = state.creativeBatches.map((b) =>
        b.id === task.creativeBatchId ? { ...b, driveUrl: action.driveUrl.trim() } : b,
      )
      // §9.3 — the linked setup task unblocks.
      db.setupTasks = state.setupTasks.map((t) =>
        t.launchId === task.launchId && t.status === 'WAITING_FOR_CREATIVE'
          ? { ...t, status: 'READY' }
          : t,
      )
      log(
        db,
        action.actorId,
        'creative_task',
        task.id,
        isUpdate ? 'CREATIVE_SUBMISSION_UPDATED' : 'CREATIVE_SUBMITTED',
        { driveUrl: action.driveUrl },
      )
      return db
    }

    case 'CREATIVE_SET_REQUEST': {
      assertCanWrite(role, 'creativeRequest')
      const task = state.creativeTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Creative task not found.')
      const note = action.note?.trim()
      db.creativeTasks = state.creativeTasks.map((t) =>
        t.id === task.id
          ? note
            ? { ...t, requestNote: note, requestAt: now().toISOString() }
            : { ...t, requestNote: undefined, requestAt: undefined }
          : t,
      )
      log(
        db,
        action.actorId,
        'creative_task',
        task.id,
        note ? 'CREATIVE_REQUEST_RAISED' : 'CREATIVE_REQUEST_CLEARED',
        note ? { note } : undefined,
      )
      return db
    }

    // -----------------------------------------------------------------------
    case 'SETUP_SET_BLOCKER': {
      assertCanWrite(role, 'blockers')
      const task = state.setupTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Setup task not found.')
      if (task.status === 'COMPLETED') {
        throw new LaunchRuleError('This launch is already live; nothing to block.')
      }
      const reason = action.reason?.trim()
      db.setupTasks = state.setupTasks.map((t) =>
        t.id === task.id
          ? reason
            ? { ...t, blockedReason: reason, blockedBy: action.actorId, blockedAt: now().toISOString() }
            : { ...t, blockedReason: undefined, blockedBy: undefined, blockedAt: undefined }
          : t,
      )
      log(
        db,
        action.actorId,
        'setup_task',
        task.id,
        reason ? 'SETUP_BLOCKED' : 'SETUP_UNBLOCKED',
        reason ? { reason } : undefined,
      )
      return db
    }

    // -----------------------------------------------------------------------
    case 'ACCOUNT_CREATE': {
      assertCanWrite(role, 'accounts')
      const displayName = action.displayName.trim()
      if (!displayName) throw new LaunchRuleError('The ad account needs its display name.')
      if (!state.countries.some((c) => c.id === action.countryId)) {
        throw new LaunchRuleError('Pick a country for the account.')
      }
      // §4.2 — extract the leading numeric token, but let Charles override it.
      const adAccountNumber = (action.adAccountNumber ?? '').trim() || extractAdAccountNumber(displayName)
      if (state.adAccounts.some((a) => a.displayName === displayName)) {
        throw new LaunchRuleError('An account with that display name already exists.')
      }
      const id = nextId('ac')
      db.adAccounts = [
        ...state.adAccounts,
        {
          id,
          countryId: action.countryId,
          displayName,
          adAccountNumber,
          store: action.store?.trim() || undefined,
          supplier: action.supplier?.trim() || undefined,
          status: 'ACTIVE',
        },
      ]
      log(db, action.actorId, 'ad_account', id, 'ACCOUNT_CREATED', { displayName, adAccountNumber })
      return db
    }

    case 'ACCOUNT_SET_STATUS': {
      assertCanWrite(role, 'accountHealth')
      const acc = adAccount(state, action.accountId)
      if (!acc) throw new LaunchRuleError('Ad account not found.')
      const reason = action.reason?.trim()
      // A problem needs a reason (others act on it); off-boarding does not — it
      // is a record that the account is gone, and a note is optional.
      if (action.status !== 'ACTIVE' && action.status !== 'OFFBOARDED' && !reason) {
        throw new LaunchRuleError('Say what the problem is — the reason is what everyone else sees.')
      }
      db.adAccounts = state.adAccounts.map((a) =>
        a.id === acc.id
          ? {
              ...a,
              status: action.status,
              statusReason: action.status === 'ACTIVE' ? undefined : reason,
              statusChangedBy: action.actorId,
              statusChangedAt: now().toISOString(),
            }
          : a,
      )
      log(db, action.actorId, 'ad_account', acc.id, 'ACCOUNT_STATUS_SET', {
        status: action.status,
        reason,
      })
      return db
    }

    // -----------------------------------------------------------------------
    case 'USER_CREATE': {
      assertCanWrite(role, 'team')
      const username = action.username.trim().toLowerCase()
      const name = action.name.trim()
      if (!name) throw new LaunchRuleError('The person needs a name.')
      if (!/^[a-z0-9._-]{2,32}$/.test(username)) {
        throw new LaunchRuleError('Username: 2–32 characters, letters, numbers, dots, dashes or underscores.')
      }
      if (state.users.some((u) => u.username === username)) {
        throw new LaunchRuleError(`The username "${username}" is already taken.`)
      }
      db.users = [
        ...state.users,
        {
          id: `u_${username}`,
          username,
          name,
          role: action.role,
          active: true,
          sortOrder: Math.max(0, ...state.users.map((u) => u.sortOrder)) + 1,
          passwordHash: action.passwordHash,
        },
      ]
      log(db, action.actorId, 'user', `u_${username}`, 'USER_CREATED', { role: action.role })
      return db
    }

    case 'USER_SET_ACTIVE': {
      assertCanWrite(role, 'team')
      const target = state.users.find((u) => u.id === action.userId)
      if (!target) throw new LaunchRuleError('User not found.')
      if (target.id === action.actorId && !action.active) {
        throw new LaunchRuleError('You cannot deactivate yourself.')
      }
      // Never leave the team without a media buyer — nobody could get back in to fix it.
      if (
        !action.active &&
        target.role === 'MEDIA_BUYER' &&
        !state.users.some((u) => u.role === 'MEDIA_BUYER' && u.active && u.id !== target.id)
      ) {
        throw new LaunchRuleError('This is the only active media buyer. Add another before deactivating.')
      }
      db.users = state.users.map((u) => (u.id === target.id ? { ...u, active: action.active } : u))
      log(db, action.actorId, 'user', target.id, action.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED')
      return db
    }

    // -----------------------------------------------------------------------
    case 'SETUP_COMPLETE': {
      assertCanWrite(role, 'completeSetup')
      const task = state.setupTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Setup task not found.')
      if (task.status === 'WAITING_FOR_CREATIVE') {
        throw new LaunchRuleError('Creative has not been submitted yet.')
      }
      const stamp = now().toISOString()
      const launch = state.launches.find((l) => l.id === task.launchId)

      db.setupTasks = state.setupTasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'COMPLETED',
              completedBy: action.actorId,
              completedAt: stamp,
              // A completed launch is by definition no longer blocked.
              blockedReason: undefined,
              blockedBy: undefined,
              blockedAt: undefined,
            }
          : t,
      )
      // Completing setup is what makes a launch live — this is the timestamp
      // Danny's day-by-day view and Mark's history both read.
      db.launches = state.launches.map((l) =>
        l.id === task.launchId ? { ...l, launchedAt: stamp, status: 'LAUNCHED' } : l,
      )
      db.adsets = state.adsets.map((a) =>
        a.id === launch?.destinationAdsetId
          ? { ...a, status: 'ACTIVE', launchedAt: stamp }
          : a,
      )
      db.creativeTasks = state.creativeTasks.map((t) =>
        t.launchId === task.launchId && t.status === 'SUBMITTED'
          ? { ...t, status: 'COMPLETED' }
          : t,
      )
      log(db, action.actorId, 'setup_task', task.id, 'SETUP_COMPLETED')
      return db
    }

    // -----------------------------------------------------------------------
    case 'SETUP_SET_CHECK': {
      // Mark's QA marker. Writes three fields and nothing else — no status change,
      // no launch side effect. §11.2: "it must remain non-blocking".
      assertCanWrite(role, 'qaCheck')
      const task = state.setupTasks.find((t) => t.id === action.taskId)
      if (!task) throw new LaunchRuleError('Setup task not found.')
      const stamp = now().toISOString()
      db.setupTasks = state.setupTasks.map((t) =>
        t.id === task.id
          ? action.checked
            ? {
                ...t,
                checkedBy: action.actorId,
                checkedAt: stamp,
                checkNote: action.note?.trim() || undefined,
              }
            : { ...t, checkedBy: undefined, checkedAt: undefined, checkNote: undefined }
          : t,
      )
      log(
        db,
        action.actorId,
        'setup_task',
        task.id,
        action.checked ? 'SETUP_QA_CHECKED' : 'SETUP_QA_UNCHECKED',
        action.note ? { note: action.note } : undefined,
      )
      return db
    }

    // -----------------------------------------------------------------------
    case 'FOLLOWUP_DISMISS': {
      assertCanWrite(role, 'followups')
      const existing = state.followups.find(
        (f) => f.sourceAdsetId === action.sourceAdsetId,
      )
      db.followups = existing
        ? state.followups.map((f) =>
            f.id === existing.id ? { ...f, status: 'DISMISSED' } : f,
          )
        : [
            ...state.followups,
            {
              id: nextId('fu'),
              sourceAdsetId: action.sourceAdsetId,
              eligibleAt: now().toISOString(),
              status: 'DISMISSED',
            },
          ]
      log(db, action.actorId, 'followup', action.sourceAdsetId, 'FOLLOWUP_DISMISSED')
      return db
    }

    case 'ADSET_ARCHIVE': {
      assertCanWrite(role, 'workspace')
      db.adsets = state.adsets.map((a) =>
        a.id === action.adsetId ? { ...a, status: 'ARCHIVED' } : a,
      )
      log(db, action.actorId, 'adset', action.adsetId, 'ADSET_ARCHIVED')
      return db
    }

    case 'ACCOUNT_SET_NUMBER': {
      assertCanWrite(role, 'workspace')
      db.adAccounts = state.adAccounts.map((a) =>
        a.id === action.accountId
          ? { ...a, adAccountNumber: action.number.trim() }
          : a,
      )
      log(db, action.actorId, 'ad_account', action.accountId, 'ACCOUNT_NUMBER_SET', {
        number: action.number,
      })
      return db
    }
  }
}

// ---------------------------------------------------------------------------
// Context

interface StoreValue {
  db: Db
  currentUser: User
  signOut: () => void
  /** Last rule/permission/storage error, shown inline by the screens. */
  error?: string
  clearError: () => void
  run: (action: Action) => boolean
  createLaunch: (input: CreateLaunchInput) => boolean
  reset: () => void
}

const StoreContext = createContext<StoreValue | undefined>(undefined)

/**
 * Boots from the local IndexedDB database before rendering anything, so no screen
 * ever renders against seed data that is about to be replaced by what is on disk.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  // Order matters: session first, database second. On Firebase the database is
  // team-only, so it can only be read by a signed-in user; locally it makes no
  // difference. `undefined` = still restoring; `null` = signed out.
  const [session, setSession] = useState<string | null | undefined>(undefined)
  const [boot, setBoot] = useState<Db | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((userId) => {
        if (!cancelled) setSession(userId)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load (or reload) the database whenever a seat is established and we do not
  // hold a copy for it. Every sign-in therefore reads fresh — the previous seat
  // may have written since this page loaded, and StoreRoot's persistence baseline
  // must be what is actually stored, never an earlier snapshot.
  useEffect(() => {
    if (!session || boot) return
    let cancelled = false
    loadDatabase()
      .then((result) => {
        if (!cancelled) setBoot(result.db)
      })
      .catch((e: unknown) => {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [session, boot])

  const signOut = () => {
    void clearSession()
    setSession(null)
    setBoot(null)
    setBootError(null)
  }

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-fg-tertiary">Opening…</div>
  }

  if (session === null) {
    return (
      <SignIn
        onSignedIn={async (userId) => {
          await saveSession(userId)
          setBoot(null)
          setSession(userId)
        }}
      />
    )
  }

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-[480px]">
          <p className="font-medium">Could not open the database.</p>
          <p className="text-fg-secondary">{bootError}</p>
          <p className="text-xs text-fg-tertiary">
            On Firebase: make sure the Firestore rules from <code>firestore.rules</code> are published and
            Email/Password sign-in is enabled. Locally: private-browsing windows block IndexedDB in some browsers.
          </p>
          <button
            type="button"
            className="mt-3 text-xs underline text-fg-secondary hover:text-fg"
            onClick={signOut}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    )
  }

  if (!boot) {
    return <div className="min-h-screen flex items-center justify-center text-fg-tertiary">Loading…</div>
  }

  // A session for a user who no longer exists (or is inactive) is signed out.
  const sessionUser = boot.users.find((u) => u.id === session && u.active)
  if (!sessionUser) {
    signOut()
    return null
  }

  return (
    <StoreRoot key={sessionUser.id} initialDb={boot} userId={sessionUser.id} onSignOut={signOut}>
      {children}
    </StoreRoot>
  )
}

function StoreRoot({
  initialDb,
  userId,
  onSignOut,
  children,
}: {
  initialDb: Db
  userId: string
  onSignOut: () => void
  children: ReactNode
}) {
  const [db, setDb] = useState(initialDb)
  const [error, setError] = useState<string | undefined>()

  const currentUser = db.users.find((u) => u.id === userId) ?? db.users[0]

  // The reducer is applied here, synchronously, against `latest` — never inside
  // React's render via useReducer. Two reasons: a rule error (full CBO, twin name,
  // batch in flight) must be *caught* and shown, not thrown from render; and two
  // clicks in the same tick must see each other's result, so the second one hits
  // the rule instead of creating a duplicate.
  const latest = useRef(initialDb)

  // Another tab wrote to the database: pull it in. Both refs move with it so the
  // reload is neither re-persisted nor treated as a local edit.
  useEffect(
    () =>
      onRemoteChange(() => {
        loadDatabase()
          .then((result) => {
            latest.current = result.db
            persisted.current = result.db
            setDb(result.db)
          })
          .catch(() => {
            /* the next local action will resync */
          })
      }),
    [],
  )

  // Write-through: every accepted action lands in IndexedDB, and only the
  // collections it touched are rewritten (see db/local.ts).
  const persisted = useRef(initialDb)
  useEffect(() => {
    if (persisted.current === db) return
    const previous = persisted.current
    persisted.current = db
    persistChanges(previous, db).catch((e: unknown) => {
      setError(`Saved in memory but not to disk: ${e instanceof Error ? e.message : String(e)}`)
    })
  }, [db])

  const run = useCallback((action: Action) => {
    try {
      const next = reducer(latest.current, action)
      latest.current = next
      setDb(next)
      setError(undefined)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    }
  }, [])

  const reset = useCallback(() => {
    resetDatabase()
      .then((seed) => {
        persisted.current = seed
        latest.current = seed
        setDb(seed)
        setError(undefined)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      db,
      currentUser,
      signOut: onSignOut,
      error,
      clearError: () => setError(undefined),
      run,
      createLaunch: (input) =>
        run({ type: 'CREATE_LAUNCH', input, actorId: currentUser.id }),
      reset,
    }),
    [db, currentUser, error, run, reset, onSignOut],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

/** Convenience wrappers so screens read as intent, not as dispatch plumbing. */
export function useActions() {
  const { run, currentUser } = useStore()
  return useMemo(
    () => ({
      submitCreative: (taskId: string, driveUrl: string, note?: string) =>
        run({
          type: 'CREATIVE_SUBMIT',
          taskId,
          driveUrl,
          note,
          actorId: currentUser.id,
        }),
      setPriority: (taskId: string, priority: CreativePriority) =>
        run({ type: 'CREATIVE_SET_PRIORITY', taskId, priority, actorId: currentUser.id }),
      nextBatch: (campaignIds: string[]) =>
        run({ type: 'NEXT_BATCH', campaignIds, actorId: currentUser.id }),
      cancelLaunch: (adsetId: string) =>
        run({ type: 'LAUNCH_CANCEL', adsetId, actorId: currentUser.id }),
      setRequest: (taskId: string, note?: string) =>
        run({ type: 'CREATIVE_SET_REQUEST', taskId, note, actorId: currentUser.id }),
      setBlocker: (taskId: string, reason?: string) =>
        run({ type: 'SETUP_SET_BLOCKER', taskId, reason, actorId: currentUser.id }),
      setInstructions: (taskId: string, instructions?: string) =>
        run({ type: 'SETUP_SET_INSTRUCTIONS', taskId, instructions, actorId: currentUser.id }),
      importCampaign: (input: CampaignImportInput) =>
        run({ type: 'CAMPAIGN_IMPORT', ...input, actorId: currentUser.id }),
      importCampaigns: (items: CampaignImportInput[]) =>
        run({ type: 'CAMPAIGN_IMPORT_MANY', items, actorId: currentUser.id }),
      setCampaignHold: (campaignId: string, onHold: boolean) =>
        run({ type: 'CAMPAIGN_SET_HOLD', campaignId, onHold, actorId: currentUser.id }),
      setAccountStatus: (accountId: string, status: AdAccountStatus, reason?: string) =>
        run({ type: 'ACCOUNT_SET_STATUS', accountId, status, reason, actorId: currentUser.id }),
      createUser: (input: { name: string; username: string; role: Role; passwordHash?: string }) =>
        run({ type: 'USER_CREATE', ...input, actorId: currentUser.id }),
      setUserActive: (userId: string, active: boolean) =>
        run({ type: 'USER_SET_ACTIVE', userId, active, actorId: currentUser.id }),
      createAccount: (input: {
        countryId: string
        displayName: string
        adAccountNumber?: string
        store?: string
        supplier?: string
      }) => run({ type: 'ACCOUNT_CREATE', ...input, actorId: currentUser.id }),
      completeSetup: (taskId: string) =>
        run({ type: 'SETUP_COMPLETE', taskId, actorId: currentUser.id }),
      dismissFollowup: (sourceAdsetId: string) =>
        run({ type: 'FOLLOWUP_DISMISS', sourceAdsetId, actorId: currentUser.id }),
      archiveAdset: (adsetId: string) =>
        run({ type: 'ADSET_ARCHIVE', adsetId, actorId: currentUser.id }),
      setAccountNumber: (accountId: string, number: string) =>
        run({ type: 'ACCOUNT_SET_NUMBER', accountId, number, actorId: currentUser.id }),
      /** QA marker — records that Mark looked. Blocks nothing (§11.2). */
      setQaCheck: (taskId: string, checked: boolean, note?: string) =>
        run({ type: 'SETUP_SET_CHECK', taskId, checked, note, actorId: currentUser.id }),
    }),
    [run, currentUser.id],
  )
}

/** Re-exported so reducer internals stay private but tests/screens can reuse it. */
export { isCampaignFull, slotsUsed }
