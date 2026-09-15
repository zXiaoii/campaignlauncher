// Status vocabulary and the colour each status owns. One hue means one thing
// across every screen — if a new state needs a colour, add it here, not inline.
//
//   blue    NEW · planned · normal priority · to do
//   violet  SWE (swipe expansion)
//   amber   REL (relaunch) · waiting · stopped
//   rose    DIT (deep iteration) · high priority
//   green   ready · live · submitted
//   red     late · blocked · killed

import { Chip, type ChipTone } from './components/ui'
import type {
  AdAccountStatus,
  AdsetStatus,
  CampaignType,
  ConceptType,
  CreativePriority,
  CreativeStatus,
  LaunchMode,
  SetupStatus,
} from './types'

export const CREATIVE_STATUS_LABEL: Record<CreativeStatus, string> = {
  TODO: 'To Do',
  SUBMITTED: 'Submitted',
  COMPLETED: 'Completed',
}

export const SETUP_STATUS_LABEL: Record<SetupStatus, string> = {
  WAITING_FOR_CREATIVE: 'Waiting for Creative',
  READY: 'Ready for Setup',
  COMPLETED: 'Completed',
}

/** Short form for dense table cells (§10.2 uses "Waiting" / "Ready"). */
export const SETUP_STATUS_SHORT: Record<SetupStatus, string> = {
  WAITING_FOR_CREATIVE: 'Waiting',
  READY: 'Ready',
  COMPLETED: 'Completed',
}

export const ADSET_STATUS_LABEL: Record<AdsetStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Live',
  STOPPED: 'Stopped',
  KILLED: 'Killed',
  ARCHIVED: 'Archived',
}

const ADSET_STATUS_TONE: Record<AdsetStatus, ChipTone> = {
  PLANNED: 'info',
  ACTIVE: 'success',
  STOPPED: 'warn',
  KILLED: 'danger',
  ARCHIVED: 'quiet',
}

export const LAUNCH_MODE_LABEL: Record<LaunchMode, string> = {
  NEW_CREATIVE: 'New creatives',
  REUSE_EXACT: 'Reuse exactly',
  REUSE_PLUS_NEW: 'Reuse + add new',
  DEEP_ITERATION: 'Deep iterate source',
  OWN_BATCH: 'Own Drive batch',
}

/**
 * Setup's first question about any task: does the CBO exist in Meta yet? "Create
 * CBO" means the campaign has to be built before the ad set; "Existing CBO" means
 * the ad set is added into a campaign that is already running.
 */
export function CboExistsChip({ exists, short }: { exists: boolean; short?: boolean }) {
  return exists ? (
    <Chip tone="quiet" title="This campaign already runs in Meta — add the ad set into it.">
      {short ? 'Existing' : 'Existing CBO'}
    </Chip>
  ) : (
    <Chip tone="accent" title="This campaign does not exist in Meta yet — create the CBO first, then the ad set inside it.">
      {short ? '＋ Create' : '＋ Create CBO'}
    </Chip>
  )
}

export const CONCEPT_TYPE_LABEL: Record<ConceptType, string> = {
  SWIPES_PLAYBOOK: 'Swipes + Playbook',
  SWIPES: 'Pure Swipes',
  ITERATION: 'Iteration',
  DEEP_ITERATION: 'Deep Iteration',
  VARIATION: 'Variation',
  CUSTOM: 'Custom',
}

export const CAMPAIGN_TYPE_MEANING: Record<CampaignType, string> = {
  NEW: 'New product launch',
  SWE: 'Swipe Expansion',
  REL: 'Relaunch / reuse',
  DIT: 'Deep Iteration',
  MAIN: 'Main CBO — imported from Meta with its existing name',
}

export const CAMPAIGN_TYPE_TONE: Record<CampaignType, ChipTone> = {
  NEW: 'info',
  SWE: 'violet',
  REL: 'warn',
  DIT: 'rose',
  MAIN: 'success',
}

/** CSS variable for the type's hue — for borders and dots, not text. */
export const CAMPAIGN_TYPE_COLOR: Record<CampaignType, string> = {
  NEW: 'var(--info)',
  SWE: 'var(--violet)',
  REL: 'var(--warn)',
  DIT: 'var(--rose)',
  MAIN: 'var(--success)',
}

export const ACCOUNT_STATUS_LABEL: Record<AdAccountStatus, string> = {
  ACTIVE: 'Healthy',
  RESTRICTED: 'Restricted',
  IN_REVIEW: 'In review',
  DISABLED: 'Disabled',
  PAUSED: 'Paused',
  OFFBOARDED: 'Off-boarded',
}

export const ACCOUNT_STATUS_TONE: Record<AdAccountStatus, ChipTone> = {
  ACTIVE: 'success',
  RESTRICTED: 'danger',
  IN_REVIEW: 'warn',
  DISABLED: 'danger',
  PAUSED: 'quiet',
  OFFBOARDED: 'default',
}

export const ACCOUNT_STATUSES: AdAccountStatus[] = [
  'ACTIVE',
  'RESTRICTED',
  'IN_REVIEW',
  'DISABLED',
  'PAUSED',
  'OFFBOARDED',
]

/**
 * A problem is temporary and needs someone's attention — it shows in the Problems
 * filter. Off-boarded is final: not a problem to fix, just gone.
 */
export function isAccountProblem(status: AdAccountStatus): boolean {
  return status !== 'ACTIVE' && status !== 'OFFBOARDED'
}

export function isAccountOffboarded(status: AdAccountStatus): boolean {
  return status === 'OFFBOARDED'
}

/** Can work be queued into it? Only a healthy account. */
export function isAccountUsable(status: AdAccountStatus): boolean {
  return status === 'ACTIVE'
}

export function AccountStatusChip({ status }: { status: AdAccountStatus }) {
  const mark = status === 'ACTIVE' ? '● ' : status === 'OFFBOARDED' ? '⊘ ' : '⚠ '
  return (
    <Chip tone={ACCOUNT_STATUS_TONE[status]}>
      {mark}
      {ACCOUNT_STATUS_LABEL[status]}
    </Chip>
  )
}

export const PRIORITY_LABEL: Record<CreativePriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
}

export const PRIORITIES: CreativePriority[] = ['HIGH', 'NORMAL', 'LOW']

// ------------------------------------------------------------------ chips

export function CampaignTypeChip({ type }: { type: CampaignType }) {
  return (
    <Chip tone={CAMPAIGN_TYPE_TONE[type]} title={CAMPAIGN_TYPE_MEANING[type]}>
      {type}
    </Chip>
  )
}

export function CreativeStatusChip({ status }: { status: CreativeStatus }) {
  const tone: ChipTone = status === 'TODO' ? 'info' : status === 'SUBMITTED' ? 'success' : 'quiet'
  return <Chip tone={tone}>{CREATIVE_STATUS_LABEL[status]}</Chip>
}

export function PriorityChip({ priority }: { priority: CreativePriority }) {
  const tone: ChipTone = priority === 'HIGH' ? 'rose' : priority === 'LOW' ? 'quiet' : 'info'
  return <Chip tone={tone}>{PRIORITY_LABEL[priority]}</Chip>
}

export function SetupStatusChip({
  status,
  short,
  late,
}: {
  status: SetupStatus
  short?: boolean
  late?: boolean
}) {
  const text = short ? SETUP_STATUS_SHORT[status] : SETUP_STATUS_LABEL[status]
  if (late && status !== 'COMPLETED') return <Chip tone="danger">{text} · late</Chip>
  const tone: ChipTone =
    status === 'READY' ? 'success' : status === 'WAITING_FOR_CREATIVE' ? 'warn' : 'quiet'
  return <Chip tone={tone}>{text}</Chip>
}

export function BlockedChip({ reason }: { reason?: string }) {
  return (
    <Chip tone="danger" title={reason}>
      ⛔ Blocked
    </Chip>
  )
}

export function RequestChip({ note }: { note?: string }) {
  return (
    <Chip tone="warn" title={note}>
      ✎ Request
    </Chip>
  )
}

export function AdsetStatusChip({ status }: { status: AdsetStatus }) {
  return <Chip tone={ADSET_STATUS_TONE[status]}>{ADSET_STATUS_LABEL[status]}</Chip>
}
