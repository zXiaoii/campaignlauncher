// Ad Accounts directory — one card per supplier account across every market:
// the campaigns on it and whether each is live, plus how much open work points
// at it. Charles adds accounts here (§4.2 number extraction happens on the way
// in); Danny browses read-only.

import { useState } from 'react'

import { useToast } from '../components/Toaster'
import {
  Block,
  Button,
  Callout,
  Chip,
  cn,
  Drawer,
  EmptyState,
  Field,
  inputClass,
  mono,
  PageHead,
  Section,
  Segmented,
  selectClass,
  textareaClass,
  type ChipTone,
} from '../components/ui'
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUSES,
  AccountStatusChip,
  BlockedChip,
  CampaignTypeChip,
  CreativeStatusChip,
  isAccountOffboarded,
  isAccountProblem,
  PriorityChip,
  SetupStatusChip,
} from '../labels'
import { guessAccountDetails, matchAccount, parseAccountList, type PastedAccount } from '../importing'
import { extractAdAccountNumber, formatTime, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { accountOpenRows, accountSummaries, userName, type AccountSummary } from '../selectors'
import { useActions, useStore } from '../store'
import type { AdAccountStatus } from '../types'

type Category = 'ALL' | 'PROBLEMS' | 'HEALTHY' | 'OFFBOARDED'

/** One colour per supplier so the split reads at a glance across the grid. */
const SUPPLIER_TONE: Record<string, ChipTone> = {
  'GO DGTL': 'violet',
  ADSC: 'info',
  RHKA: 'rose',
}
/** What is on the account: something live, only planned work, or nothing at all. */
type Activity = 'ALL' | 'LIVE' | 'PLANNED' | 'EMPTY'

export function AdAccounts({ onOpenAdset }: { onOpenAdset: (adsetId: string) => void }) {
  const { db, currentUser } = useStore()
  const { setAccountsHold } = useActions()
  const { show } = useToast()
  const [query, setQuery] = useState('')
  const [countryId, setCountryId] = useState('ALL')
  const [category, setCategory] = useState<Category>('ALL')
  const [activity, setActivity] = useState<Activity>('ALL')
  const [supplier, setSupplier] = useState('ALL')
  const [tasksFor, setTasksFor] = useState<string | null>(null)
  const [statusFor, setStatusFor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [retiring, setRetiring] = useState(false)

  const canAdd = currentUser.role === 'MEDIA_BUYER'
  // Charles plans on accounts; setup is the first to find out one is broken.
  const canSetStatus = currentUser.role === 'MEDIA_BUYER' || currentUser.role === 'SETUP'
  const q = query.trim().toLowerCase()

  const everything = accountSummaries(db)
  // Off-boarded accounts live in their own tab; every count and filter below is
  // about the accounts still in play.
  const offboarded = everything.filter((s) => isAccountOffboarded(s.account.status))
  const all = everything.filter((s) => !isAccountOffboarded(s.account.status))
  const problems = all.filter((s) => isAccountProblem(s.account.status))
  const suppliers = [...new Set(all.map((s) => s.account.supplier).filter((x): x is string => Boolean(x)))].sort()

  const activityOf = (s: AccountSummary): Exclude<Activity, 'ALL'> =>
    s.campaigns.some((c) => c.live) ? 'LIVE' : s.campaigns.length > 0 ? 'PLANNED' : 'EMPTY'
  const activityCounts = all.reduce(
    (m, s) => ({ ...m, [activityOf(s)]: (m[activityOf(s)] ?? 0) + 1 }),
    {} as Partial<Record<Activity, number>>,
  )

  const shown = (category === 'OFFBOARDED' ? offboarded : all)
    .filter(
      (s) =>
        (countryId === 'ALL' || s.account.countryId === countryId) &&
        (supplier === 'ALL' || s.account.supplier === supplier) &&
        (activity === 'ALL' || activityOf(s) === activity) &&
        (category === 'ALL' ||
          category === 'OFFBOARDED' ||
          (category === 'PROBLEMS') === isAccountProblem(s.account.status)) &&
        (!q ||
          s.account.displayName.toLowerCase().includes(q) ||
          s.account.adAccountNumber.includes(q) ||
          s.countryCode.toLowerCase().includes(q) ||
          (s.account.supplierRef ?? '').toLowerCase().includes(q) ||
          (s.account.store ?? '').toLowerCase().includes(q) ||
          s.campaigns.some((c) => c.campaign.name.toLowerCase().includes(q))),
    )
    // Broken accounts float to the top — they are the ones needing a decision.
    .sort((a, b) => Number(isAccountProblem(b.account.status)) - Number(isAccountProblem(a.account.status)))

  const liveCount = all.reduce((n, s) => n + s.campaigns.filter((c) => c.live).length, 0)

  return (
    <>
      <PageHead
        title={
          <>
            Ad Accounts <Chip tone="accent">{all.length} accounts</Chip>
            {problems.length > 0 && (
              <Chip tone="danger">
                ⚠ {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
              </Chip>
            )}
            {offboarded.length > 0 && <Chip tone="quiet">⊘ {offboarded.length} off-boarded</Chip>}
          </>
        }
        sub={`Every supplier account across ${db.countries.map((c) => c.code).join(', ')} with its health, campaigns, live state and open work. ${liveCount} live CBOs.`}
      >
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Category"
            value={category}
            options={[
              { value: 'ALL' as Category, label: 'All' },
              { value: 'PROBLEMS' as Category, label: `Problems (${problems.length})` },
              { value: 'HEALTHY' as Category, label: 'Healthy' },
              { value: 'OFFBOARDED' as Category, label: `Off-boarded (${offboarded.length})` },
            ]}
            onChange={setCategory}
          />
          {canAdd && (
            <Button
              variant="danger"
              onClick={() => setRetiring(true)}
              title="Several accounts gone at once (a restriction wave): off-board them and kill their CBOs in one step. History stays."
            >
              ⊘ Retire accounts…
            </Button>
          )}
          {canAdd && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              + Add account
            </Button>
          )}
        </div>
      </PageHead>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Segmented
          ariaLabel="Activity"
          value={activity}
          options={[
            { value: 'ALL' as Activity, label: 'Any' },
            { value: 'LIVE' as Activity, label: `Live (${activityCounts.LIVE ?? 0})` },
            { value: 'PLANNED' as Activity, label: `Planned only (${activityCounts.PLANNED ?? 0})` },
            { value: 'EMPTY' as Activity, label: `Empty (${activityCounts.EMPTY ?? 0})` },
          ]}
          onChange={setActivity}
        />
        <select
          className={cn(selectClass, 'w-auto')}
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
        >
          <option value="ALL">All markets</option>
          {db.countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        {/* Supplier is the split the team thinks in (ADSC vs GO DGTL), so it is one click. */}
        <Segmented
          ariaLabel="Supplier"
          value={supplier}
          options={[
            { value: 'ALL', label: 'All suppliers' },
            ...suppliers.map((s) => ({
              value: s,
              label: `${s} (${all.filter((a) => a.account.supplier === s).length})`,
            })),
          ]}
          onChange={setSupplier}
        />
        <input
          className={cn(inputClass, 'min-w-[180px] flex-[0_1_260px]')}
          placeholder="Search number, name, campaign…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(activity !== 'ALL' || supplier !== 'ALL' || countryId !== 'ALL' || category !== 'ALL' || q) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActivity('ALL')
              setSupplier('ALL')
              setCountryId('ALL')
              setCategory('ALL')
              setQuery('')
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="flex-1" />
        {/* Bulk hold: whatever the filters show — typically one supplier, e.g. all RHKA. */}
        {canAdd && category !== 'OFFBOARDED' && shown.length > 0 && (supplier !== 'ALL' || countryId !== 'ALL' || q) && (
          <>
            {shown.some((s) => !s.account.onHold) && (
              <Button
                size="sm"
                onClick={() => {
                  const ids = shown.filter((s) => !s.account.onHold).map((s) => s.account.id)
                  if (window.confirm(`Put ${ids.length} ${ids.length === 1 ? 'account' : 'accounts'} on hold? They keep running; nothing new is launched into them.`)) {
                    if (setAccountsHold(ids, true)) show({ tone: 'default', kind: 'On hold', title: `${ids.length} accounts`, body: 'Next batch and the bulk trigger skip their CBOs.' })
                  }
                }}
              >
                ⏸ Hold the {shown.filter((s) => !s.account.onHold).length} shown
              </Button>
            )}
            {shown.some((s) => s.account.onHold) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const ids = shown.filter((s) => s.account.onHold).map((s) => s.account.id)
                  if (setAccountsHold(ids, false)) show({ tone: 'success', kind: 'Resumed', title: `${ids.length} accounts`, body: 'Next batch can target them again.' })
                }}
              >
                ▶ Resume the {shown.filter((s) => s.account.onHold).length} held
              </Button>
            )}
          </>
        )}
        <span className="text-xs text-fg-secondary whitespace-nowrap">
          {shown.length} of {category === 'OFFBOARDED' ? offboarded.length : all.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={
            category === 'PROBLEMS'
              ? 'No problem accounts.'
              : category === 'OFFBOARDED'
                ? 'No off-boarded accounts.'
                : 'No accounts match.'
          }
          hint={
            category === 'PROBLEMS'
              ? 'Every account is healthy.'
              : category === 'OFFBOARDED'
                ? 'Mark an account off-boarded from its card when it is banned, dead or no longer used.'
                : 'Try a number, a store name or a market code.'
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3">
          {shown.map((s) => (
            <AccountCard
              key={s.account.id}
              summary={s}
              onViewTasks={() => setTasksFor(s.account.id)}
              onSetStatus={canSetStatus ? () => setStatusFor(s.account.id) : undefined}
              onToggleHold={
                canAdd
                  ? () => {
                      if (setAccountsHold([s.account.id], !s.account.onHold)) {
                        show({
                          tone: s.account.onHold ? 'success' : 'default',
                          kind: s.account.onHold ? 'Resumed' : 'On hold',
                          title: s.account.displayName,
                          body: s.account.onHold
                            ? 'Next batch can target its CBOs again.'
                            : 'It keeps running; nothing new is launched into it.',
                        })
                      }
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {statusFor && <AccountStatusDrawer accountId={statusFor} onClose={() => setStatusFor(null)} />}

      {tasksFor && (
        <AccountTasksDrawer
          accountId={tasksFor}
          onClose={() => setTasksFor(null)}
          onOpenAdset={(id) => {
            setTasksFor(null)
            onOpenAdset(id)
          }}
        />
      )}

      {adding && <AddAccountDrawer onClose={() => setAdding(false)} />}
      {retiring && <RetireAccountsDrawer initialCountryId={countryId} onClose={() => setRetiring(false)} />}
    </>
  )
}

function AccountCard({
  summary: s,
  onViewTasks,
  onSetStatus,
  onToggleHold,
}: {
  summary: AccountSummary
  onViewTasks: () => void
  onSetStatus?: () => void
  onToggleHold?: () => void
}) {
  const { db } = useStore()
  const problem = isAccountProblem(s.account.status)
  const gone = isAccountOffboarded(s.account.status)
  return (
    <article
      className={cn(
        'flex flex-col border border-line border-l-2 rounded-2xl bg-surface shadow-highlight overflow-hidden transition-colors hover:border-line-strong',
        gone ? 'border-l-line-strong opacity-60' : problem ? 'border-l-danger' : 'border-l-success',
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <div className={cn(mono, 'text-[15px] font-semibold leading-snug break-words text-fg')}>
            {s.account.displayName}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-secondary">
            <AccountStatusChip status={s.account.status} />
            <Chip tone="quiet">{s.countryCode}</Chip>
            {s.account.supplier && (
              <Chip tone={SUPPLIER_TONE[s.account.supplier] ?? 'default'}>{s.account.supplier}</Chip>
            )}
            {s.account.supplierRef && (
              <span className={cn(mono, 'text-fg-tertiary')} title="Supplier's label for this account">
                {s.account.supplierRef}
              </span>
            )}
            {s.account.store && !s.account.supplierRef && <span>{s.account.store}</span>}
            {!s.account.adAccountNumber && <Chip tone="danger">no account number</Chip>}
            {s.account.onHold && (
              <Chip tone="warn" title="Keeps running; nothing new is launched into it and Next batch skips its CBOs.">
                ⏸ On hold
              </Chip>
            )}
          </div>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <div className="inline-flex flex-col items-center px-2.5 py-1.5 border border-line rounded-lg bg-surface-raised">
            <span className="text-lg font-semibold leading-none tabular-nums">{s.campaigns.length}</span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-fg-tertiary mt-1">
              {s.campaigns.length === 1 ? 'campaign' : 'campaigns'}
            </span>
          </div>
        </div>
      </div>

      {problem && (
        <div className="mx-4 mb-3 px-3 py-2 border border-danger-border rounded-lg bg-danger-bg text-xs">
          <div className="text-fg">{s.account.statusReason ?? 'No reason recorded.'}</div>
          {s.account.statusChangedAt && (
            <div className="mt-0.5 text-fg-tertiary">
              {userName(db, s.account.statusChangedBy)} · {formatTime(s.account.statusChangedAt)} · new
              launches are held until this is Healthy again
            </div>
          )}
        </div>
      )}
      {gone && (
        <div className="mx-4 mb-3 px-3 py-2 border border-line rounded-lg bg-bg-subtle text-xs">
          <div className="text-fg">{s.account.statusReason ?? 'Off-boarded — banned, dead or no longer used.'}</div>
          {s.account.statusChangedAt && (
            <div className="mt-0.5 text-fg-tertiary">
              {userName(db, s.account.statusChangedBy)} · {formatTime(s.account.statusChangedAt)} · hidden from
              the workspace; kept here for history
            </div>
          )}
        </div>
      )}

      <div className="px-4 pb-3">
        <div className="mb-1.5 text-[10.5px] font-medium tracking-[0.06em] uppercase text-fg-tertiary">
          Campaigns on this account
        </div>
        {s.campaigns.length === 0 ? (
          <p className="m-0 text-xs italic text-fg-tertiary">No campaigns running.</p>
        ) : (
          <div className="grid gap-1.5">
            {s.campaigns.map(({ campaign, used, live }) => (
              <div
                key={campaign.id}
                className="flex items-center gap-2 px-2.5 py-2 border border-line rounded-lg bg-bg-subtle"
                style={{ borderLeftWidth: 2, borderLeftColor: `var(--${live ? 'success' : 'line-strong'})` }}
              >
                <span className={cn(mono, 'font-medium truncate')} title={campaign.name}>
                  {campaign.name}
                </span>
                <CampaignTypeChip type={campaign.campaignType} />
                <span className="ml-auto shrink-0 flex items-center gap-1.5">
                  <span className="text-[11px] text-fg-tertiary tabular-nums">
                    {used}/{MAX_ADSETS_PER_CAMPAIGN}
                  </span>
                  {live ? <Chip tone="success">LIVE</Chip> : <Chip tone="quiet">planned</Chip>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 px-4 py-2.5 border-t border-line bg-bg-subtle">
        <span className="text-xs text-fg-secondary">
          {s.openTasks} open {s.openTasks === 1 ? 'task' : 'tasks'}
        </span>
        {s.blocked > 0 && <BlockedChip reason={`${s.blocked} blocked`} />}
        <span className="flex-1" />
        {onToggleHold && !gone && (
          <Button size="sm" variant="ghost" onClick={onToggleHold} title={s.account.onHold ? 'Let Next batch target this account again.' : 'Keep it running, launch nothing new into it.'}>
            {s.account.onHold ? '▶ Resume' : '⏸ Hold'}
          </Button>
        )}
        {onSetStatus && (
          <Button size="sm" variant={problem ? 'danger' : 'ghost'} onClick={onSetStatus}>
            {gone ? 'Bring back' : problem ? 'Update status' : 'Report a problem'}
          </Button>
        )}
        <Button size="sm" onClick={onViewTasks} disabled={s.openTasks === 0}>
          View tasks →
        </Button>
      </div>
    </article>
  )
}

/**
 * Account health. A problem needs a reason — it is the line everyone else reads
 * on the card, in the workspace header and in the setup drawer — and setting an
 * account back to Healthy clears it.
 */
function AccountStatusDrawer({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { setAccountStatus } = useActions()
  const { show } = useToast()
  const account = db.adAccounts.find((a) => a.id === accountId)
  const [status, setStatus] = useState<AdAccountStatus>(account?.status ?? 'ACTIVE')
  const [reason, setReason] = useState(account?.statusReason ?? '')

  if (!account) return null
  const problemStatus = status !== 'ACTIVE' && status !== 'OFFBOARDED'
  const needsReason = problemStatus
  const unchanged = status === account.status && reason.trim() === (account.statusReason ?? '')

  return (
    <Drawer
      title={account.displayName}
      subtitle={
        <>
          <AccountStatusChip status={account.status} />
          {account.statusChangedAt && (
            <span className="ml-2 text-fg-tertiary">
              set by {userName(db, account.statusChangedBy)} · {formatTime(account.statusChangedAt)}
            </span>
          )}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-fg-tertiary">
            {status === 'OFFBOARDED'
              ? 'Removed from the workspace and every launch picker. Campaigns and history stay on record.'
              : needsReason
                ? 'New launches on this account are held until it is Healthy again.'
                : 'Healthy — launches go through normally.'}
          </span>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={status === 'ACTIVE' ? 'primary' : 'danger'}
            disabled={unchanged || (needsReason && !reason.trim())}
            title={needsReason && !reason.trim() ? 'Say what the problem is.' : undefined}
            onClick={() => {
              if (setAccountStatus(account.id, status, status === 'ACTIVE' ? undefined : reason)) {
                show({
                  tone: status === 'ACTIVE' ? 'success' : status === 'OFFBOARDED' ? 'default' : 'danger',
                  kind: ACCOUNT_STATUS_LABEL[status],
                  title: account.displayName,
                  body:
                    status === 'OFFBOARDED'
                      ? 'Off-boarded — gone from the workspace, kept in the directory for history.'
                      : needsReason
                        ? `Reported: ${reason.trim()}. New launches on this account are held; the team can see it.`
                        : 'Marked healthy — launches go through again.',
                  ms: 9000,
                })
                onClose()
              }
            }}
          >
            {status === 'ACTIVE'
              ? 'Mark healthy'
              : status === 'OFFBOARDED'
                ? 'Off-board this account'
                : `Mark ${ACCOUNT_STATUS_LABEL[status].toLowerCase()}`}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </Callout>
      )}

      <Section title="Status">
        <div className="grid gap-1.5">
          {ACCOUNT_STATUSES.map((s) => (
            <label
              key={s}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 border rounded-lg cursor-pointer transition-colors',
                status === s
                  ? 'border-accent-border bg-accent-bg/60'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover',
              )}
            >
              <input
                type="radio"
                name="account-status"
                className="accent-accent"
                checked={status === s}
                onChange={() => setStatus(s)}
              />
              <AccountStatusChip status={s} />
              <span className="text-xs text-fg-tertiary">
                {s === 'ACTIVE' && 'Working normally.'}
                {s === 'RESTRICTED' && 'Meta restriction on the BM or account — cannot publish.'}
                {s === 'IN_REVIEW' && 'Under review or verification — spend or publishing limited.'}
                {s === 'DISABLED' && 'Disabled by Meta. Nothing runs here.'}
                {s === 'PAUSED' && 'Paused by us on purpose.'}
                {s === 'OFFBOARDED' && 'Banned, dead or no longer used. Hidden everywhere except this directory.'}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {(needsReason || status === 'OFFBOARDED') && (
        <Section title={status === 'OFFBOARDED' ? 'Note (optional)' : 'What is wrong'}>
          <Field
            label={status === 'OFFBOARDED' ? 'Why it was off-boarded' : 'Reason'}
            hint={
              status === 'OFFBOARDED'
                ? 'Optional — "banned Sep 12", "closed by supplier", or nothing.'
                : 'One line. This is what Charles, setup and Mark see.'
            }
          >
            <textarea
              className={textareaClass}
              value={reason}
              autoFocus
              placeholder="e.g. BM restricted — under Meta review since Sep 20. Appeal filed, no ETA."
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </Section>
      )}
    </Drawer>
  )
}

function AccountTasksDrawer({
  accountId,
  onClose,
  onOpenAdset,
}: {
  accountId: string
  onClose: () => void
  onOpenAdset: (adsetId: string) => void
}) {
  const { db } = useStore()
  const account = db.adAccounts.find((a) => a.id === accountId)
  const rows = accountOpenRows(db, accountId)

  return (
    <Drawer
      title={account?.displayName ?? 'Ad account'}
      subtitle={`${rows.length} open ${rows.length === 1 ? 'task' : 'tasks'} on this account`}
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <EmptyState title="Nothing open on this account." />
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <button
              key={r.launch.id}
              type="button"
              onClick={() => onOpenAdset(r.adset.id)}
              className="text-left px-3 py-2.5 border border-line rounded-lg bg-surface hover:bg-surface-hover hover:border-line-strong transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={cn(mono, 'font-medium truncate')}>{r.campaign.name}</span>
                <CampaignTypeChip type={r.campaign.campaignType} />
                <span className="ml-auto text-xs text-fg-tertiary">{r.product.name}</span>
              </div>
              <div className={cn(mono, 'mt-0.5 text-fg-secondary')}>{r.adset.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {r.creativeTask && r.creativeTask.status === 'TODO' && (
                  <>
                    <span className="text-[11px] text-fg-tertiary">Creative</span>
                    <PriorityChip priority={r.creativeTask.priority} />
                    <CreativeStatusChip status={r.creativeTask.status} />
                  </>
                )}
                {r.setupTask && r.setupTask.status !== 'COMPLETED' && (
                  <>
                    <span className="text-[11px] text-fg-tertiary ml-1">Setup</span>
                    <SetupStatusChip status={r.setupTask.status} short />
                    {r.setupTask.blockedReason && <BlockedChip reason={r.setupTask.blockedReason} />}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  )
}

/**
 * The restriction wave, in one step. Charles ticks the accounts that are gone;
 * they become off-boarded, every CBO on them is killed, and anything still in
 * flight on them is cancelled. Nothing that ever went live is deleted — launches,
 * completions, blockers and the activity log all stay for Danny's history. The
 * fresh accounts and CBOs then come in through "Add existing CBO" on top.
 */
function RetireAccountsDrawer({ initialCountryId, onClose }: { initialCountryId: string; onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { retireAccounts } = useActions()
  const { show } = useToast()
  const [countryId, setCountryId] = useState(initialCountryId)
  const [reason, setReason] = useState('Banned by Meta — relaunched on a new account')
  const [pasted, setPasted] = useState('')
  const [recordUnknown, setRecordUnknown] = useState(true)
  const inPlay = accountSummaries(db).filter((s) => !isAccountOffboarded(s.account.status))
  const summaries = inPlay.filter((s) => countryId === 'ALL' || s.account.countryId === countryId)
  // Problem accounts are the obvious candidates, so they start ticked.
  const [picked, setPicked] = useState<string[]>(() =>
    inPlay.filter((s) => isAccountProblem(s.account.status)).map((s) => s.account.id),
  )
  const chosen = inPlay.filter((s) => picked.includes(s.account.id))

  // The pasted supplier panel: every name that matches an account in play gets
  // ticked; names the directory has never met can be recorded as off-boarded so the
  // book shows what Meta shows.
  const pastedAccounts = parseAccountList(pasted)
  const pastedMatched = pastedAccounts
    .map((p) => ({ p, acc: matchAccount(p.displayName, db.adAccounts) }))
    .filter((x): x is { p: PastedAccount; acc: NonNullable<typeof x.acc> } => Boolean(x.acc))
  const pastedAlreadyOff = pastedMatched.filter((x) => isAccountOffboarded(x.acc.status)).length
  const pastedUnknown = pastedAccounts
    .filter((p) => !matchAccount(p.displayName, db.adAccounts))
    .map((p) => ({ ...p, ...guessAccountDetails(p.displayName, db.countries, db.adAccounts) }))
  const unknownPlaced = pastedUnknown.filter((u) => u.countryId)
  const unknownUnplaced = pastedUnknown.filter((u) => !u.countryId)
  const applyPaste = (text: string) => {
    setPasted(text)
    const ids = parseAccountList(text)
      .map((p) => matchAccount(p.displayName, db.adAccounts))
      .filter((a): a is NonNullable<typeof a> => Boolean(a) && !isAccountOffboarded(a!.status))
      .map((a) => a.id)
    if (ids.length) setPicked((prev) => [...new Set([...prev, ...ids])])
  }
  const cboCount = chosen.reduce((n, s) => n + s.campaigns.length, 0)
  const inFlight = chosen.reduce(
    (n, s) => n + s.campaigns.reduce((m, c) => m + db.adsets.filter((a) => a.campaignId === c.campaign.id && a.status === 'PLANNED').length, 0),
    0,
  )
  const liveSets = chosen.reduce(
    (n, s) =>
      n +
      s.campaigns.reduce(
        (m, c) => m + db.adsets.filter((a) => a.campaignId === c.campaign.id && (a.status === 'ACTIVE' || a.status === 'STOPPED')).length,
        0,
      ),
    0,
  )
  const recording = recordUnknown ? unknownPlaced : []
  const total = chosen.length + recording.length
  const marketsHit = [...new Set(chosen.map((s) => s.countryCode))].join(', ')

  return (
    <Drawer
      wide
      title="Retire ad accounts"
      subtitle="Off-board the accounts that are gone and kill their CBOs in one step. Everything that ever went live stays in history."
      onClose={onClose}
      footer={
        <>
          <div className="min-w-0 text-xs text-fg-secondary">
            {chosen.length} {chosen.length === 1 ? 'account' : 'accounts'} → off-boarded
            {recording.length > 0 && ` (+${recording.length} recorded)`} · {cboCount} {cboCount === 1 ? 'CBO' : 'CBOs'} → killed ·{' '}
            {liveSets} live ad {liveSets === 1 ? 'set' : 'sets'} → killed · {inFlight} planned {inFlight === 1 ? 'launch' : 'launches'} → cancelled
          </div>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={total === 0}
            onClick={() => {
              if (
                !window.confirm(
                  `Retire ${chosen.length} ${chosen.length === 1 ? 'account' : 'accounts'}${marketsHit ? ` (${marketsHit})` : ''}? ${cboCount} ${cboCount === 1 ? 'CBO' : 'CBOs'} will be marked killed and ${inFlight} planned ${inFlight === 1 ? 'launch' : 'launches'} cancelled.${
                    recording.length ? ` ${recording.length} banned ${recording.length === 1 ? 'account' : 'accounts'} the directory never had will be recorded as off-boarded.` : ''
                  } Launch history is kept.`,
                )
              ) {
                return
              }
              if (
                retireAccounts(
                  picked,
                  reason,
                  recording.map((u) => ({ displayName: u.displayName, countryId: u.countryId!, supplier: u.supplier, timezone: u.timezone })),
                )
              ) {
                show({
                  tone: 'default',
                  kind: 'Retired',
                  title: `${total} ${total === 1 ? 'account' : 'accounts'}${marketsHit ? ` · ${marketsHit}` : ''}`,
                  body: `${cboCount} ${cboCount === 1 ? 'CBO' : 'CBOs'} killed, ${inFlight} in-flight ${inFlight === 1 ? 'launch' : 'launches'} cancelled. Now import the new accounts with Add existing CBO.`,
                  ms: 10000,
                })
                onClose()
              }
            }}
          >
            ⊘ Retire {total || ''}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </Callout>
      )}

      <Callout>
        <strong>What stays:</strong> every launch that went live, who completed it and when, blockers, QA checks,
        the activity log — Danny&apos;s dashboard and Launches keep reading exactly as before.{' '}
        <strong>What changes:</strong> the accounts move to Off-boarded, their CBOs to Killed (visible behind the
        Killed filter), their ad sets to the Library as killed. Planned launches on them are cancelled, since they
        will be relaunched elsewhere.
      </Callout>

      <Section title="Paste the banned list" trailing={pastedAccounts.length > 0 ? <Chip tone="accent">{pastedAccounts.length} names</Chip> : undefined}>
        <Field
          label="Straight from the supplier panel"
          hint="One account per block — name, ID, date, status, balance, timezone — exactly as it copies. Every name that matches an account here gets ticked."
        >
          <textarea
            className={cn(textareaClass, 'font-mono text-xs min-h-24')}
            value={pasted}
            placeholder={'#7966 - UK | AD 17 - Danny - ADSC\nID: 772747162195771\nbanned\nEurope/London'}
            onChange={(e) => applyPaste(e.target.value)}
          />
        </Field>
        {pastedAccounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="danger">{pastedMatched.length - pastedAlreadyOff} to retire</Chip>
            {pastedAlreadyOff > 0 && <Chip tone="quiet">{pastedAlreadyOff} already off-boarded</Chip>}
            {pastedUnknown.length > 0 && <Chip tone="warn">{pastedUnknown.length} not in the directory</Chip>}
          </div>
        )}
        {pastedUnknown.length > 0 && (
          <div className="mt-3 p-3 border border-line rounded-lg bg-surface">
            <label className="flex items-start gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={recordUnknown} onChange={(e) => setRecordUnknown(e.target.checked)} />
              <span>
                Record the {pastedUnknown.length} banned {pastedUnknown.length === 1 ? 'account' : 'accounts'} the directory never had as
                off-boarded, in the market their names say
                {unknownUnplaced.length > 0 && (
                  <>
                    {' '}
                    — <strong>{unknownUnplaced.length} cannot be placed</strong> from the name and will be skipped
                  </>
                )}
                .
              </span>
            </label>
            {recordUnknown && (
              <Block className="mt-2 max-h-40 overflow-auto">
                {pastedUnknown
                  .map((u) => `${u.countryId ? (db.countries.find((c) => c.id === u.countryId)?.code ?? '?').padEnd(9) : 'SKIP     '} ${u.displayName}`)
                  .join('\n')}
              </Block>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Or tick them"
        trailing={
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setPicked(summaries.map((s) => s.account.id))}>
              All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked(summaries.filter((s) => s.campaigns.length > 0).map((s) => s.account.id))}>
              With CBOs
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
              None
            </Button>
          </span>
        }
      >
        <div className="mb-2.5">
          <Segmented
            ariaLabel="Market"
            value={countryId}
            options={[{ value: 'ALL', label: `All (${inPlay.length})` }, ...db.countries.map((c) => ({ value: c.id, label: `${c.code} (${inPlay.filter((s) => s.account.countryId === c.id).length})` }))]}
            onChange={setCountryId}
          />
        </div>
        {summaries.length === 0 ? (
          <p className="m-0 text-fg-secondary">No accounts in play in this market.</p>
        ) : (
          <div className="border border-line rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
            {summaries.map((s) => {
              const on = picked.includes(s.account.id)
              return (
                <label
                  key={s.account.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 border-b border-line last:border-b-0 cursor-pointer transition-colors hover:bg-surface-hover',
                    on && 'bg-danger-bg/30',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.account.id] : p.filter((id) => id !== s.account.id)))}
                  />
                  <span className={cn(mono, 'min-w-0 flex-1 truncate')} title={s.account.displayName}>
                    {s.account.displayName}
                  </span>
                  <span className="text-xs text-fg-tertiary">{s.countryCode}</span>
                  <AccountStatusChip status={s.account.status} />
                  <span className="text-xs text-fg-secondary whitespace-nowrap">
                    {s.campaigns.length} {s.campaigns.length === 1 ? 'CBO' : 'CBOs'}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Reason">
        <Field label="Written on every retired account" hint="Setup and Danny see this on the account and in the activity feed.">
          <textarea className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Section>

      {chosen.length > 0 && (
        <Section title="Review">
          <Block>
            {[
              ...chosen.map((s) => `ACCOUNT   ${s.account.displayName}   → off-boarded`),
              ...chosen.flatMap((s) => s.campaigns.map((c) => `CBO       ${c.campaign.name}   → killed`)),
            ].join('\n')}
          </Block>
        </Section>
      )}
    </Drawer>
  )
}

function AddAccountDrawer({ onClose }: { onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { createAccount } = useActions()
  const [countryId, setCountryId] = useState(db.countries[0].id)
  const [displayName, setDisplayName] = useState('')
  const [numberOverride, setNumberOverride] = useState('')
  const [store, setStore] = useState('')
  const [supplier, setSupplier] = useState('')

  const extracted = extractAdAccountNumber(displayName)
  const number = numberOverride.trim() || extracted
  const canCreate = displayName.trim().length > 0

  return (
    <Drawer
      title="Add ad account"
      subtitle="The display name is stored exactly; campaign naming uses only the number."
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-fg-tertiary">
            {number ? (
              <>
                Campaigns will be named <span className={cn(mono, 'text-fg')}>TYPE Product {number}</span>
              </>
            ) : (
              'No number found yet — enter one below.'
            )}
          </span>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canCreate}
            onClick={() => {
              if (createAccount({ countryId, displayName, adAccountNumber: number, store, supplier })) onClose()
            }}
          >
            Add account
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </Callout>
      )}

      <Section title="Account">
        <Field label="Market">
          <select className={selectClass} value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            {db.countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Display name" hint="Paste it exactly as the supplier shows it, e.g. 50643 reliore [GO DGTL]">
          <input
            className={cn(inputClass, 'font-mono')}
            value={displayName}
            autoFocus
            placeholder="50643 reliore [GO DGTL]"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field
          label="Ad account number"
          hint={
            extracted
              ? `Extracted "${extracted}" from the display name. Override only if that is wrong.`
              : 'Could not extract a leading number — type it here.'
          }
        >
          <input
            className={cn(inputClass, 'font-mono')}
            value={numberOverride}
            placeholder={extracted || 'e.g. 50643'}
            onChange={(e) => setNumberOverride(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Store (optional)">
            <input className={inputClass} value={store} placeholder="reliore" onChange={(e) => setStore(e.target.value)} />
          </Field>
          <Field label="Supplier (optional)">
            <input className={inputClass} value={supplier} placeholder="GO DGTL" onChange={(e) => setSupplier(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Preview">
        <Block>
          {[
            `DISPLAY NAME       ${displayName.trim() || '—'}`,
            `AD ACCOUNT NUMBER  ${number || '—'}`,
            `EXAMPLE CAMPAIGN   ${number ? `NEW FlexiVita ${number}` : '—'}`,
          ].join('\n')}
        </Block>
      </Section>
    </Drawer>
  )
}
