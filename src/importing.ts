// Importing what already runs in Meta. Charles pastes ad-set names one per line,
// exactly as they appear; this turns each line into the record the seed would
// have produced for it, so imported and seeded CBOs are indistinguishable.
//
// The date at the front of the name (MM/DD/YY, the §1.4 convention) becomes the
// launch date at noon local time; the words after it decide the framework, which
// is what Next batch models the next launch on.

import { CONCEPT_LABELS } from './naming'
import type { ConceptType } from './types'

export interface ParsedAdset {
  /** Exactly as typed, trimmed. */
  name: string
  /** ISO timestamp when the name starts with a date; unset otherwise. */
  launchedAt?: string
  conceptType: ConceptType
  conceptLabel: string
  /** Why this line will be refused, when it will. */
  problem?: string
}

/** Name of the stand-in ad set a CBO gets when its real ad sets are not known yet. */
export const PLACEHOLDER_ADSET_NAME = 'existing ads'

const DATE_PREFIX = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b\s*/

export function parseAdsetLine(raw: string): ParsedAdset | null {
  const name = raw.trim()
  if (!name) return null

  let launchedAt: string | undefined
  let rest = name
  const m = name.match(DATE_PREFIX)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const d = new Date(year, month - 1, day, 12, 0, 0, 0)
    // Reject 13/40/26 and friends: the Date object silently rolls over.
    if (d.getMonth() === month - 1 && d.getDate() === day) {
      launchedAt = d.toISOString()
      rest = name.slice(m[0].length)
    }
  }

  const words = rest.toLowerCase()
  const conceptType: ConceptType = words.includes('deep')
    ? 'DEEP_ITERATION'
    : words.includes('iter')
      ? 'ITERATION'
      : words.includes('swipe') || rest.trim() === ''
        ? 'SWIPES_PLAYBOOK'
        : 'CUSTOM'
  const conceptLabel = conceptType === 'CUSTOM' ? rest.trim() || name : CONCEPT_LABELS[conceptType]

  return { name, launchedAt, conceptType, conceptLabel }
}

/**
 * All lines of a paste, in order, with duplicates flagged. Empty lines are dropped.
 * `existingNames` are ad sets already in the destination CBO.
 */
export function parseAdsetLines(text: string, existingNames: string[] = []): ParsedAdset[] {
  const seen = new Set(existingNames)
  const out: ParsedAdset[] = []
  for (const raw of text.split('\n')) {
    const parsed = parseAdsetLine(raw)
    if (!parsed) continue
    if (seen.has(parsed.name)) {
      parsed.problem = existingNames.includes(parsed.name)
        ? 'Already in this CBO.'
        : 'Typed twice.'
    }
    seen.add(parsed.name)
    out.push(parsed)
  }
  return out
}
