// Naming service — PRD §4. Campaign naming and ad-set naming are separate systems.
// Campaign = why/product/account. Ad set = when/concept.

import type { CampaignType, ConceptType } from './types'

/**
 * Hard maximum of ad sets per CBO — never exceeded through UI or API.
 * PRD §1.4 shipped this as 3; raised to 4 on the team's request after the first build.
 */
export const MAX_ADSETS_PER_CAMPAIGN = 4

export const CAMPAIGN_TYPES: { code: CampaignType; meaning: string }[] = [
  { code: 'NEW', meaning: 'Initial / new product launch' },
  { code: 'SWE', meaning: 'Swipe Expansion' },
  { code: 'REL', meaning: 'Relaunch / reuse of an older batch' },
  { code: 'DIT', meaning: 'Deep Iteration' },
]

export const CONCEPT_LABELS: Record<ConceptType, string> = {
  SWIPES_PLAYBOOK: 'swipes + playbook',
  SWIPES: 'pure swipes',
  ITERATION: 'iteration',
  DEEP_ITERATION: 'deep iteration',
  VARIATION: 'variation',
  CUSTOM: '',
}

/**
 * Default direction per framework, prefilled into new briefs. Blank on purpose
 * (Charles, 17 Sep 2026): the framework name itself is the brief; anything more
 * is typed per launch.
 */
export const DEFAULT_DIRECTION: Record<ConceptType, string> = {
  SWIPES_PLAYBOOK: '',
  SWIPES: '',
  ITERATION: '',
  DEEP_ITERATION: '',
  VARIATION: '',
  CUSTOM: '',
}

/**
 * Next batch cadence: a CBO takes a new batch only once its latest ad set has
 * been live this many days. Stops the trigger from stacking a batch a day.
 */
export const MIN_DAYS_BETWEEN_BATCHES = 2

/**
 * Cost-cap CBOs are tuned by hand and never get an automatic batch. Recognised
 * by name, the way the team names them: "DIR OZEMPIL COSTCAP", "… cost cap …".
 */
export function isCostCapCampaign(name: string): boolean {
  return /cost\s*[-_]?\s*cap/i.test(name)
}

export const CONCEPT_NAMES: Record<ConceptType, string> = {
  SWIPES_PLAYBOOK: 'Swipes + Playbook',
  SWIPES: 'Pure Swipes',
  ITERATION: 'Iteration',
  DEEP_ITERATION: 'Deep Iteration',
  VARIATION: 'Variation',
  CUSTOM: 'Custom',
}

/**
 * §4.2 — supplier display names are messy. Take the leading numeric token,
 * ignoring a leading "#": "50643 reliore [GO DGTL]" -> "50643",
 * "#8178 - AUS | AD 4 - Danny - ADSC" -> "8178". Returns '' when there is none,
 * so the UI can prompt for a manual correction rather than silently inventing one.
 */
export function extractAdAccountNumber(displayName: string): string {
  const match = displayName.trim().match(/^#?\s*(\d+)/)
  return match ? match[1] : ''
}

/** §4.1 — `[TYPE] [PRODUCT] [AD ACCOUNT NUMBER]`, normalized number only. */
export function buildCampaignName(
  type: CampaignType,
  productName: string,
  adAccountNumber: string,
): string {
  return `${type} ${productName} ${adAccountNumber}`.replace(/\s+/g, ' ').trim()
}

/**
 * §4.3 — append a numeric suffix only when the same type+product+account name
 * is already taken. `existingNames` should be the names in the destination account.
 */
export function dedupeCampaignName(base: string, existingNames: string[]): string {
  const taken = new Set(existingNames)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** MM/DD/YY — the format every destination ad-set name starts with (§1.4). */
export function formatLaunchDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseDateInput(date) : date
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

/** Parses `YYYY-MM-DD` (and ISO timestamps) as local time, not UTC. */
export function parseDateInput(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

/**
 * §4.4 — `[CURRENT LAUNCH DATE] [CONCEPT LABEL]`.
 * The source date never leaks in here; callers pass the *new* launch date.
 */
export function buildAdsetName(
  launchDate: Date | string,
  conceptLabel: string,
): string {
  return `${formatLaunchDate(launchDate)} ${conceptLabel.trim()}`.trim()
}

/** Date input value (`YYYY-MM-DD`) for a Date, in local time. */
export function toDateInputValue(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function sameDay(a: Date | string, b: Date | string): boolean {
  const da = typeof a === 'string' ? new Date(a) : a
  const db = typeof b === 'string' ? new Date(b) : b
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Relative due label used in the task tables ("Today", "Tomorrow", "2d late").
 * `now` is passed in so the prototype's fixed clock stays testable.
 */
export function dueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt)
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round(
    (startOfDue.getTime() - startOfNow.getTime()) / 86_400_000,
  )
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)}d late`
  return formatLaunchDate(due)
}

export function isLate(dueAt: string, now: Date): boolean {
  return new Date(dueAt).getTime() < now.getTime()
}
