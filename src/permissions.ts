// Permissions — PRD §2.2 matrix and §2.3 role enum.
//
// In the real app this table is the *backend* authority (§2.3: "Do not rely on
// hidden buttons alone"). In the prototype there is no server, so the same table
// drives both navigation and the guards inside the store's mutations — keeping a
// single source of truth that can be lifted into an API layer verbatim.

import type { Role } from './types'

export type Area =
  | 'workspace'
  | 'launches'
  | 'creativeTasks'
  | 'setupTasks'
  | 'createLaunch'
  | 'editBrief'
  | 'submitCreative'
  | 'completeSetup'
  | 'library'
  | 'followups'
  | 'qaCheck'
  | 'blockers'
  | 'accounts'
  | 'accountHealth'
  | 'creativeRequest'
  | 'team'
  | 'storeChecks'

export type Access = 'full' | 'read' | 'summary' | 'own' | 'setupOnly' | 'none'

export const PERMISSIONS: Record<Area, Record<Role, Access>> = {
  workspace: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  launches: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'own',
    SETUP_QA: 'setupOnly',
    STORE: 'none',
  },
  creativeTasks: {
    MEDIA_BUYER: 'full',
    CEO: 'summary',
    CREATIVE: 'own',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  setupTasks: {
    MEDIA_BUYER: 'full',
    CEO: 'summary',
    CREATIVE: 'none',
    SETUP: 'own',
    SETUP_QA: 'read',
    STORE: 'none',
  },
  createLaunch: {
    MEDIA_BUYER: 'full',
    CEO: 'none',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  editBrief: {
    MEDIA_BUYER: 'full',
    CEO: 'none',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  submitCreative: {
    MEDIA_BUYER: 'read',
    CEO: 'read',
    CREATIVE: 'full',
    SETUP: 'read',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  completeSetup: {
    MEDIA_BUYER: 'read',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'full',
    SETUP_QA: 'read',
    STORE: 'none',
  },
  library: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'read',
    SETUP: 'read',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  followups: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  /**
   * The QA checkmark is Mark's alone to set — Charles and Danny can see it, the
   * setup users cannot mark their own work as checked, and it gates nothing (§11.2).
   */
  qaCheck: {
    MEDIA_BUYER: 'read',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'read',
    SETUP_QA: 'full',
    STORE: 'none',
  },
  /** Setup raises and clears blockers; everyone who sees setup work sees them. */
  blockers: {
    MEDIA_BUYER: 'read',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'full',
    SETUP_QA: 'read',
    STORE: 'none',
  },
  /** Ad-account directory. Charles adds/corrects accounts; Danny browses. */
  accounts: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  /**
   * Account health. Setup can flag it (they hit the restriction first), Charles
   * can flag and clear it, everyone who plans or builds sees it.
   */
  accountHealth: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'full',
    SETUP_QA: 'read',
    STORE: 'none',
  },
  /** Yzah's request back to Charles on a creative task; Charles clears it. */
  creativeRequest: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'full',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  /** Who is on the team and in which seat. Charles builds it; Danny can look. */
  team: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'none',
  },
  /**
   * Products live per market, with the Funnelish / Shopify ticks. The store seat
   * sets them, Charles can too, Danny reads. Like QA, the ticks gate nothing.
   */
  storeChecks: {
    MEDIA_BUYER: 'full',
    CEO: 'read',
    CREATIVE: 'none',
    SETUP: 'none',
    SETUP_QA: 'none',
    STORE: 'full',
  },
}

export function access(role: Role, area: Area): Access {
  return PERMISSIONS[area][role]
}

export function canView(role: Role, area: Area): boolean {
  return access(role, area) !== 'none'
}

export function canWrite(role: Role, area: Area): boolean {
  const a = access(role, area)
  return a === 'full' || a === 'own'
}

export class PermissionError extends Error {
  constructor(role: Role, area: Area) {
    super(`${role} is not allowed to write to ${area}`)
    this.name = 'PermissionError'
  }
}

export function assertCanWrite(role: Role, area: Area): void {
  if (!canWrite(role, area)) throw new PermissionError(role, area)
}

// ---------------------------------------------------------------------------
// Navigation — §2.1. Shallow by design: every task is ≤2 clicks from home.

export interface NavItem {
  key: string
  label: string
}

export const NAV: Record<Role, NavItem[]> = {
  MEDIA_BUYER: [
    { key: 'workspace', label: 'Workspace' },
    { key: 'launches', label: 'Launches' },
    { key: 'creative', label: 'Creative Tasks' },
    { key: 'setup', label: 'Setup Tasks' },
    { key: 'accounts', label: 'Ad Accounts' },
    { key: 'library', label: 'Library' },
    { key: 'followups', label: '48H Follow-ups' },
    { key: 'products', label: 'Products Live' },
    { key: 'team', label: 'Team' },
  ],
  CEO: [
    { key: 'overview', label: 'Overview' },
    { key: 'launches', label: 'Launches' },
    { key: 'countries', label: 'Countries' },
    { key: 'creative', label: 'Creative Tasks' },
    { key: 'setup', label: 'Setup Tasks' },
    { key: 'accounts', label: 'Ad Accounts' },
    { key: 'products', label: 'Products Live' },
    { key: 'team', label: 'Team' },
  ],
  /** One screen: which products are advertised where, and whether the funnel and store are fine. */
  STORE: [{ key: 'products', label: 'Products Live' }],
  CREATIVE: [{ key: 'creative', label: 'Creative Tasks' }],
  SETUP: [{ key: 'setup', label: 'Setup Tasks' }],
  SETUP_QA: [
    { key: 'setupOverview', label: 'Setup Overview' },
    { key: 'setupHistory', label: 'Setup History' },
  ],
}
