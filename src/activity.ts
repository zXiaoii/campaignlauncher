// Every activity-log row as one readable line — "what everyone did" for Danny's
// dashboard. The notification feed (selectors.setupEvents) covers only the
// handover events; this covers all of them, Charles's planning included.

import { adAccount, adset, campaign, rowForCreativeTask, rowForSetupTask, user } from './selectors'
import type { ActivityLog, Db } from './types'

/** Coarse bucket, for the per-person summary line and the tone of the row. */
export type ActivityKind =
  | 'launch' // planned a launch / next batch / cancelled
  | 'import' // brought existing CBOs in
  | 'campaign' // hold / resume / kill / revive / archive
  | 'creative' // Yzah submitted or updated
  | 'request' // Yzah asked Charles something
  | 'setup' // setup completed a launch
  | 'blocker' // raised / cleared
  | 'qa' // Mark checked
  | 'account' // ad account health / directory
  | 'team' // people added / deactivated
  | 'other'

export interface ActivityLine {
  id: string
  at: string
  userId: string
  userName: string
  kind: ActivityKind
  /** Past tense, names included, no actor — the card it sits in names the person. */
  text: string
  /** Where clicking should land, when there is somewhere to land. */
  adsetId?: string
}

const KIND_OF: Record<string, ActivityKind> = {
  LAUNCH_CREATED: 'launch',
  NEXT_BATCH: 'launch',
  LAUNCH_CANCELLED: 'launch',
  SETUP_INSTRUCTIONS_SET: 'launch',
  CREATIVE_PRIORITY_SET: 'launch',
  CAMPAIGN_IMPORTED: 'import',
  CAMPAIGNS_IMPORTED: 'import',
  CAMPAIGN_HELD: 'campaign',
  CAMPAIGN_RESUMED: 'campaign',
  CAMPAIGN_KILLED: 'campaign',
  CAMPAIGN_REVIVED: 'campaign',
  ADSET_ARCHIVED: 'campaign',
  FOLLOWUP_DISMISSED: 'campaign',
  CREATIVE_SUBMITTED: 'creative',
  CREATIVE_SUBMISSION_UPDATED: 'creative',
  CREATIVE_REQUEST_RAISED: 'request',
  CREATIVE_REQUEST_CLEARED: 'request',
  SETUP_COMPLETED: 'setup',
  SETUP_BLOCKED: 'blocker',
  SETUP_UNBLOCKED: 'blocker',
  SETUP_QA_CHECKED: 'qa',
  SETUP_QA_UNCHECKED: 'qa',
  ACCOUNT_CREATED: 'account',
  ACCOUNT_STATUS_SET: 'account',
  ACCOUNT_RETIRED: 'account',
  ACCOUNT_NUMBER_SET: 'account',
  USER_CREATED: 'team',
  USER_DEACTIVATED: 'team',
  USER_REACTIVATED: 'team',
}

export const KIND_LABEL: Record<ActivityKind, string> = {
  launch: 'planned',
  import: 'imported',
  campaign: 'CBO changes',
  creative: 'submitted',
  request: 'requests',
  setup: 'launched live',
  blocker: 'blockers',
  qa: 'QA checks',
  account: 'accounts',
  team: 'team',
  other: 'other',
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

/** "09/14/26 swipes + playbook · MAIN CBO Revida 4" for a task or launch, when it still exists. */
function whereForSetupTask(db: Db, taskId: string) {
  const row = rowForSetupTask(db, taskId)
  return row ? { where: `${row.adset.name} · ${row.campaign.name}`, adsetId: row.adset.id } : undefined
}
function whereForCreativeTask(db: Db, taskId: string) {
  const row = rowForCreativeTask(db, taskId)
  return row ? { where: `${row.adset.name} · ${row.campaign.name}`, adsetId: row.adset.id } : undefined
}
function whereForLaunch(db: Db, launchId: string) {
  const l = db.launches.find((x) => x.id === launchId)
  const a = adset(db, l?.destinationAdsetId)
  const cm = campaign(db, l?.destinationCampaignId)
  return a && cm ? { where: `${a.name} · ${cm.name}`, adsetId: a.id } : undefined
}

export function describeActivity(db: Db, l: ActivityLog): ActivityLine | null {
  const actor = user(db, l.userId)
  const m = l.metadata ?? {}
  const kind = KIND_OF[l.eventType] ?? 'other'
  let text: string
  let adsetId: string | undefined

  switch (l.eventType) {
    case 'LAUNCH_CREATED': {
      const w = whereForLaunch(db, l.entityId)
      adsetId = w?.adsetId
      const name = w?.where ?? [str(m.adsetName), str(m.campaignName)].filter(Boolean).join(' · ')
      const mode = str(m.mode)
      const how =
        mode === 'REUSE_EXACT'
          ? 'relaunch, no creative task'
          : mode === 'OWN_BATCH'
            ? 'own Drive batch, setup ready'
            : mode === 'DEEP_ITERATION'
              ? 'deep iteration → Yzah'
              : mode === 'REUSE_PLUS_NEW'
                ? 'reuse + new → Yzah'
                : 'new batch → Yzah'
      text = `Planned ${name} (${how})${str(m.instructions) ? ' with instructions' : ''}`
      break
    }
    case 'NEXT_BATCH': {
      const n = num(m.campaigns) ?? 0
      text = `Hit Next batch on ${n} ${n === 1 ? 'CBO' : 'CBOs'}`
      break
    }
    case 'LAUNCH_CANCELLED':
      text = `Cancelled the planned ${str(m.adsetName) ?? 'launch'}`
      break
    case 'SETUP_INSTRUCTIONS_SET': {
      const w = whereForSetupTask(db, l.entityId)
      adsetId = w?.adsetId
      text = str(m.instructions)
        ? `Updated setup instructions for ${w?.where ?? 'a launch'} — ${str(m.instructions)}`
        : `Removed setup instructions from ${w?.where ?? 'a launch'}`
      break
    }
    case 'CREATIVE_PRIORITY_SET': {
      const w = whereForCreativeTask(db, l.entityId)
      adsetId = w?.adsetId
      text = `Set ${w?.where ?? 'a creative task'} to ${(str(m.priority) ?? 'normal').toLowerCase()} priority`
      break
    }
    case 'CAMPAIGN_IMPORTED': {
      const sets = Array.isArray(m.adsets) ? m.adsets.length : 0
      text = m.created
        ? `Added existing CBO ${str(m.campaignName) ?? ''} with ${sets} ad ${sets === 1 ? 'set' : 'sets'}`
        : `Added ${sets} ad ${sets === 1 ? 'set' : 'sets'} to ${str(m.campaignName) ?? 'a CBO'}`
      break
    }
    case 'CAMPAIGNS_IMPORTED': {
      const n = num(m.campaigns) ?? 0
      text = `Imported ${n} ${n === 1 ? 'CBO' : 'CBOs'} from a Meta export`
      break
    }
    case 'CAMPAIGN_HELD':
      text = `Put ${str(m.campaignName) ?? 'a CBO'} on hold — no new ad sets`
      break
    case 'CAMPAIGN_RESUMED':
      text = `Resumed new ad sets for ${str(m.campaignName) ?? 'a CBO'}`
      break
    case 'CAMPAIGN_KILLED':
      text = `Killed ${str(m.campaignName) ?? 'a CBO'}`
      break
    case 'CAMPAIGN_REVIVED':
      text = `Revived ${str(m.campaignName) ?? 'a CBO'}`
      break
    case 'ADSET_ARCHIVED': {
      const a = adset(db, l.entityId)
      adsetId = a?.id
      text = `Archived ${a?.name ?? 'an ad set'}`
      break
    }
    case 'FOLLOWUP_DISMISSED': {
      const a = adset(db, l.entityId)
      adsetId = a?.id
      text = `Dismissed the 48-hour follow-up on ${a?.name ?? 'an ad set'}`
      break
    }
    case 'CREATIVE_SUBMITTED':
    case 'CREATIVE_SUBMISSION_UPDATED': {
      const w = whereForCreativeTask(db, l.entityId)
      adsetId = w?.adsetId
      text =
        l.eventType === 'CREATIVE_SUBMITTED'
          ? `Submitted the Drive link for ${w?.where ?? 'a launch'} — setup can go`
          : `Updated the Drive link for ${w?.where ?? 'a launch'}`
      break
    }
    case 'CREATIVE_REQUEST_RAISED':
    case 'CREATIVE_REQUEST_CLEARED': {
      const w = whereForCreativeTask(db, l.entityId)
      adsetId = w?.adsetId
      text =
        l.eventType === 'CREATIVE_REQUEST_RAISED'
          ? `Asked Charles about ${w?.where ?? 'a launch'}${str(m.note) ? ` — ${str(m.note)}` : ''}`
          : `Cleared the request on ${w?.where ?? 'a launch'}`
      break
    }
    case 'SETUP_COMPLETED': {
      const w = whereForSetupTask(db, l.entityId)
      adsetId = w?.adsetId
      text = `Launched ${w?.where ?? 'a launch'} live in Meta`
      break
    }
    case 'SETUP_BLOCKED':
    case 'SETUP_UNBLOCKED': {
      const w = whereForSetupTask(db, l.entityId)
      adsetId = w?.adsetId
      text =
        l.eventType === 'SETUP_BLOCKED'
          ? `Raised a blocker on ${w?.where ?? 'a launch'}${str(m.reason) ? ` — ${str(m.reason)}` : ''}`
          : `Cleared the blocker on ${w?.where ?? 'a launch'}`
      break
    }
    case 'SETUP_QA_CHECKED':
    case 'SETUP_QA_UNCHECKED': {
      const w = whereForSetupTask(db, l.entityId)
      adsetId = w?.adsetId
      text = l.eventType === 'SETUP_QA_CHECKED' ? `QA-checked ${w?.where ?? 'a launch'}` : `Removed the QA check on ${w?.where ?? 'a launch'}`
      break
    }
    case 'ACCOUNT_CREATED':
      text = m.fromImport
        ? `Added ad account ${str(m.displayName) ?? ''} from a Meta export`
        : `Added ad account ${str(m.displayName) ?? ''}`
      break
    case 'ACCOUNT_RETIRED': {
      const n = Array.isArray(m.campaigns) ? m.campaigns.length : 0
      text = `Retired ${str(m.displayName) ?? 'an account'} — off-boarded, ${n} ${n === 1 ? 'CBO' : 'CBOs'} killed${
        str(m.reason) ? ` — ${str(m.reason)}` : ''
      }`
      break
    }
    case 'ACCOUNT_STATUS_SET': {
      const acc = adAccount(db, l.entityId)
      const status = (str(m.status) ?? '').toLowerCase().replace('_', ' ')
      text =
        status === 'active'
          ? `Marked ${acc?.displayName ?? 'an account'} healthy`
          : `Reported ${acc?.displayName ?? 'an account'} as ${status}${str(m.reason) ? ` — ${str(m.reason)}` : ''}`
      break
    }
    case 'ACCOUNT_NUMBER_SET': {
      const acc = adAccount(db, l.entityId)
      text = `Corrected the account number on ${acc?.displayName ?? 'an account'}`
      break
    }
    case 'USER_CREATED': {
      const u = user(db, l.entityId)
      text = `Added ${u?.name ?? l.entityId} to the team (${(str(m.role) ?? '').replace('_', ' ').toLowerCase()})`
      break
    }
    case 'USER_DEACTIVATED':
    case 'USER_REACTIVATED': {
      const u = user(db, l.entityId)
      text = `${l.eventType === 'USER_DEACTIVATED' ? 'Deactivated' : 'Reactivated'} ${u?.name ?? l.entityId}`
      break
    }
    default:
      text = l.eventType.toLowerCase().replace(/_/g, ' ')
  }

  return {
    id: l.id,
    at: l.createdAt,
    userId: l.userId,
    userName: actor?.name ?? l.userId,
    kind,
    text,
    adsetId,
  }
}

/** Every line on one calendar day, oldest first. */
export function activityOnDay(db: Db, day: Date): ActivityLine[] {
  const y = day.getFullYear()
  const mo = day.getMonth()
  const d = day.getDate()
  return db.activityLogs
    .filter((l) => {
      const t = new Date(l.createdAt)
      return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d
    })
    .map((l) => describeActivity(db, l))
    .filter((x): x is ActivityLine => Boolean(x))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
}
