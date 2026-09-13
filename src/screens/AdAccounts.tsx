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
  const [query, setQuery] = useState('')
  const [countryId, setCountryId] = useState('ALL')
  const [category, setCategory] = useState<Category>('ALL')
  const [activity, setActivity] = useState<Activity>('ALL')
  const [supplier, setSupplier] = useState('ALL')
  const [tasksFor, setTasksFor] = useState<string | null>(null)
  const [statusFor, setStatusFor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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
        <span className="text-xs text-fg-secondary whitespace-nowrap">
          {shown.length} of {all.length}
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
    </>
  )
}

function AccountCard({
  summary: s,
  onViewTasks,
  onSetStatus,
}: {
  summary: AccountSummary
  onViewTasks: () => void
  onSetStatus?: () => void
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
