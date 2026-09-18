// Charles's visual workspace (PRD §5) and — with `readOnly` — Danny's mirrored
// Countries view (§12.3). Country → ad account → campaign → up to four ad sets.
//
// Three layouts over the same data:
//   Grid  — uniform cards, slot state as the headline (the §5.1 layout)
//   Bento — a dense mosaic; a CBO's tile grows with how much is in it, so full
//           campaigns read as big and empty ones as small at a glance
//   Table — every live ad set in the country, flat, for scanning

import { useEffect, useState } from 'react'

import {
  Button,
  Callout,
  Chip,
  cn,
  EmptyState,
  mono,
  NameTd,
  OverflowMenu,
  PageHead,
  Segmented,
  TableWrap,
  Td,
  Th,
  Toolbar,
  Tr,
  inputClass,
  selectClass,
} from '../components/ui'
import {
  AccountStatusChip,
  AdsetStatusChip,
  CAMPAIGN_TYPE_COLOR,
  CampaignTypeChip,
  isAccountProblem,
} from '../labels'
import { isPlaceholderAdset } from '../importing'
import { isCostCapCampaign, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import {
  accountsInCountry,
  adsetsInCampaign,
  campaignsInAccount,
  isCampaignFull,
  killedCampaignsInAccount,
  liveAdsets,
  OCCUPYING_STATUSES,
  plannedAdsets,
  slotsUsed,
} from '../selectors'
import { now } from '../clock'
import { CAMPAIGN_TYPES } from '../naming'
import { planNextBatch, useActions, useStore } from '../store'
import type { AdAccount, Adset, Campaign, CampaignType } from '../types'
import { ImportDrawer } from './ImportDrawer'
import type { LaunchIntent } from './LaunchDrawer'

type View = 'grid' | 'bento' | 'table'

/**
 * Campaign state, as Charles thinks about it when deciding what to do next:
 * ready for a batch, waiting on one, out of room, or sitting on a broken account.
 */
type StateFilter = 'ALL' | 'READY' | 'IN_FLIGHT' | 'LAUNCHED_TODAY' | 'FULL' | 'ON_HOLD' | 'KILLED'
const ALL = 'ALL'

const COUNTRY_KEY = 'mb.lastCountry'
const COLLAPSE_KEY = 'mb.collapsedAccounts'
const VIEW_KEY = 'mb.workspaceView'

/**
 * Remembered UI state. `scope: 'session'` forgets on the next fresh open — used
 * for collapsed accounts, so the workspace always starts fully expanded and a
 * collapse made weeks ago never hides a CBO that was added since.
 */
function usePersisted<T>(
  key: string,
  initial: T,
  valid?: (v: T) => boolean,
  scope: 'local' | 'session' = 'local',
): [T, (v: T | ((prev: T) => T)) => void] {
  const store = () => (scope === 'session' ? window.sessionStorage : window.localStorage)
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = store().getItem(key)
      const parsed = raw ? (JSON.parse(raw) as T) : initial
      return valid && !valid(parsed) ? initial : parsed
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      store().setItem(key, JSON.stringify(value))
    } catch {
      /* private mode — fall back to in-memory only */
    }
  }, [key, value]) // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue]
}

export function Workspace({
  title,
  sub,
  readOnly = false,
  onLaunch,
  onOpenAdset,
}: {
  title: string
  sub: string
  readOnly?: boolean
  onLaunch?: (intent: LaunchIntent) => void
  onOpenAdset: (adsetId: string) => void
}) {
  const { db } = useStore()
  const [countryId, setCountryId] = usePersisted(COUNTRY_KEY, db.countries[0].id)
  const [collapsed, setCollapsed] = usePersisted<string[]>(COLLAPSE_KEY, [], undefined, 'session')
  const [view, setView] = usePersisted<View>(VIEW_KEY, 'grid', (v) =>
    ['grid', 'bento', 'table'].includes(v),
  )
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<CampaignType | typeof ALL>(ALL)
  const [stateFilter, setStateFilter] = useState<StateFilter>(ALL)
  const [productFilter, setProductFilter] = useState<string>(ALL)
  // Orthogonal to state: a campaign on a problem account is still ready / full /
  // in flight — the problem is a flag on it, not a state of its own.
  const [problemOnly, setProblemOnly] = useState(false)
  const filtering = typeFilter !== ALL || stateFilter !== ALL || productFilter !== ALL || problemOnly

  // "Next batch" — one click, no form. Result line shows what was created.
  const { nextBatch } = useActions()
  const [result, setResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const canNext = !readOnly && Boolean(onLaunch)

  const country = db.countries.find((c) => c.id === countryId) ?? db.countries[0]
  // Off-boarded accounts stay out of the workspace — except behind the Killed
  // filter, where the CBOs that went down with them are exactly what is wanted.
  const accounts =
    stateFilter === 'KILLED'
      ? db.adAccounts
          .filter((a) => a.countryId === country.id)
          .sort((a, b) => a.adAccountNumber.localeCompare(b.adAccountNumber))
      : accountsInCountry(db, country.id)
  const q = query.trim().toLowerCase()
  const at = now()

  // Same rules, same order, as the Next batch button — so "Ready (N)" here is
  // always the N the bulk button will launch into.
  const stateOf = (c: Campaign): Exclude<StateFilter, 'ALL'> => {
    if (c.status === 'KILLED') return 'KILLED'
    // Cost-cap CBOs behave like on-hold ones for the trigger: hands off.
    if (c.onHold || isCostCapCampaign(c.name)) return 'ON_HOLD'
    if (isCampaignFull(db, c.id)) return 'FULL'
    if (plannedAdsets(db, c.id).length > 0) return 'IN_FLIGHT'
    // What remains is cadence: the latest ad set went live too recently for the
    // next batch (MIN_DAYS_BETWEEN_BATCHES), or today's name already exists.
    if (planNextBatch(db, c.id, at).blockedReason) return 'LAUNCHED_TODAY'
    return 'READY'
  }

  // Everything in the country, classified once — the state counts in the filter
  // come from this, so they never disagree with what the cards show.
  // Killed CBOs ride along so the Killed filter can show them; "All" hides them.
  const classified = accounts.map((account) => ({
    account,
    campaigns: [...campaignsInAccount(db, account.id), ...killedCampaignsInAccount(db, account.id)].map(
      (campaign) => ({
        campaign,
        state: stateOf(campaign),
      }),
    ),
  }))

  const stateCounts = classified
    .flatMap((a) => a.campaigns)
    .reduce(
      (m, { state }) => ({ ...m, [state]: (m[state] ?? 0) + 1 }),
      {} as Partial<Record<StateFilter, number>>,
    )
  // Killed CBOs mostly sit on off-boarded accounts, which the other views hide —
  // count them across the whole market so the filter label is honest before it is on.
  const marketAccountIds = new Set(db.adAccounts.filter((a) => a.countryId === country.id).map((a) => a.id))
  stateCounts.KILLED = db.campaigns.filter((c) => c.status === 'KILLED' && marketAccountIds.has(c.adAccountId)).length
  const problemCount = classified
    .filter((a) => isAccountProblem(a.account.status))
    .reduce((n, a) => n + a.campaigns.length, 0)

  const visible = classified
    .map(({ account, campaigns }) => ({
      account,
      campaigns: campaigns
        .filter(({ campaign, state }) => {
          if (problemOnly && !isAccountProblem(account.status)) return false
          if (typeFilter !== ALL && campaign.campaignType !== typeFilter) return false
          if (productFilter !== ALL && campaign.productId !== productFilter) return false
          if (stateFilter !== ALL && state !== stateFilter) return false
          if (stateFilter === ALL && state === 'KILLED') return false
          if (!q) return true
          const product = db.products.find((p) => p.id === campaign.productId)
          return (
            campaign.name.toLowerCase().includes(q) ||
            (product?.name ?? '').toLowerCase().includes(q) ||
            account.displayName.toLowerCase().includes(q)
          )
        })
        .map(({ campaign }) => campaign),
    }))
    // With any filter on, an account with nothing matching disappears; with none,
    // empty accounts stay visible so "+ Launch here" is reachable.
    .filter(({ account, campaigns }) =>
      q || filtering ? campaigns.length > 0 || (q && account.displayName.toLowerCase().includes(q)) : true,
    )

  const totalCbos = visible.reduce((n, v) => n + v.campaigns.length, 0)
  const allCollapsed = visible.every((v) => collapsed.includes(v.account.id))

  // Campaigns on screen that can take a next batch right now (room, nothing in
  // flight, no name clash, healthy account) — what the toolbar's bulk button targets.
  const eligible = visible.flatMap((v) =>
    v.campaigns.filter((c) => !planNextBatch(db, c.id, at).blockedReason).map((c) => c.id),
  )

  const clearFilters = () => {
    setTypeFilter(ALL)
    setStateFilter(ALL)
    setProductFilter(ALL)
    setProblemOnly(false)
    setQuery('')
  }

  return (
    <>
      <PageHead title={title} sub={sub}>
        {canNext && (
          <Button onClick={() => setImporting(true)} title="Bring a CBO that already runs in Meta into the workspace — no reset.">
            ↓ Add existing CBO
          </Button>
        )}
      </PageHead>

      {importing && <ImportDrawer countryId={country.id} onClose={() => setImporting(false)} />}

      {result && (
        <Callout className="border-l-success">
          <div className="flex items-start gap-2">
            <span className="text-success">✓</span>
            <span className="text-fg">{result}</span>
            <Button size="sm" variant="ghost" className="ml-auto shrink-0" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </Callout>
      )}

      <Toolbar>
        <Segmented
          ariaLabel="Country"
          value={country.id}
          options={db.countries.map((c) => ({ value: c.id, label: c.code }))}
          onChange={setCountryId}
        />
        <input
          className={cn(inputClass, 'min-w-[200px] flex-[0_1_280px]')}
          placeholder="Search product / account…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="flex-1" />
        <Segmented
          ariaLabel="Layout"
          value={view}
          options={[
            { value: 'grid' as View, label: 'Grid' },
            { value: 'bento' as View, label: 'Bento' },
            { value: 'table' as View, label: 'Table' },
          ]}
          onChange={setView}
        />
        {view !== 'table' && (
          <Button
            size="sm"
            onClick={() =>
              setCollapsed(allCollapsed ? [] : visible.map((v) => v.account.id))
            }
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Button>
        )}
        {canNext && (
          <Button
            size="sm"
            variant="primary"
            disabled={eligible.length === 0}
            title={
              eligible.length === 0
                ? 'Every CBO on screen is full, has a batch in flight, or launched less than two days ago.'
                : `One fresh Swipes + Playbook batch into each of the ${eligible.length} CBOs whose latest ad set has been live for two days or more.`
            }
            onClick={() => {
              const n = eligible.length
              if (nextBatch(eligible)) {
                setResult(
                  `Next batch launched into ${n} ${n === 1 ? 'campaign' : 'campaigns'} — ${n} Yzah ${n === 1 ? 'task' : 'tasks'}, ${n} setup ${n === 1 ? 'task' : 'tasks'} waiting for creative.`,
                )
              }
            }}
          >
            ⚡ Next batch · all ready ({eligible.length})
          </Button>
        )}
        <span className="text-fg-secondary whitespace-nowrap">
          {totalCbos} {totalCbos === 1 ? 'CBO' : 'CBOs'} in {country.code}
        </span>
      </Toolbar>

      <Toolbar>
        <Segmented
          ariaLabel="State"
          value={stateFilter}
          options={[
            { value: ALL as StateFilter, label: 'All' },
            { value: 'READY' as StateFilter, label: `Ready (${stateCounts.READY ?? 0})` },
            { value: 'IN_FLIGHT' as StateFilter, label: `In flight (${stateCounts.IN_FLIGHT ?? 0})` },
            { value: 'LAUNCHED_TODAY' as StateFilter, label: `Too soon (${stateCounts.LAUNCHED_TODAY ?? 0})` },
            { value: 'FULL' as StateFilter, label: `Full (${stateCounts.FULL ?? 0})` },
            { value: 'ON_HOLD' as StateFilter, label: `On hold (${stateCounts.ON_HOLD ?? 0})` },
            { value: 'KILLED' as StateFilter, label: `Killed (${stateCounts.KILLED ?? 0})` },
          ]}
          onChange={setStateFilter}
        />
        <Button
          size="sm"
          variant={problemOnly ? 'danger' : 'default'}
          aria-pressed={problemOnly}
          disabled={problemCount === 0 && !problemOnly}
          title="Only campaigns on accounts with a problem (restricted, in review…). They can still take a batch."
          onClick={() => setProblemOnly((v) => !v)}
        >
          ⚠ Problem accounts ({problemCount})
        </Button>
        <Segmented
          ariaLabel="Campaign type"
          value={typeFilter}
          options={[
            { value: ALL as CampaignType | typeof ALL, label: 'Any type' },
            { value: 'MAIN' as CampaignType | typeof ALL, label: 'MAIN' },
            ...CAMPAIGN_TYPES.map((t) => ({ value: t.code as CampaignType | typeof ALL, label: t.code })),
          ]}
          onChange={setTypeFilter}
        />
        <select
          className={cn(selectClass, 'w-auto')}
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        >
          <option value={ALL}>All products</option>
          {db.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {(filtering || q) && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Toolbar>

      {visible.length === 0 && (
        <EmptyState
          title={filtering || q ? 'No campaigns match these filters.' : `No ad accounts in ${country.code} yet.`}
          hint={filtering || q ? 'Clear a filter or pick another state.' : 'Add one from the Ad Accounts directory.'}
        />
      )}

      {view === 'table' ? (
        <AdsetTable groups={visible} onOpenAdset={onOpenAdset} />
      ) : (
        visible.map(({ account, campaigns }) => (
          <AccountContainer
            key={account.id}
            account={account}
            campaigns={campaigns}
            view={view}
            open={!collapsed.includes(account.id)}
            onToggle={() =>
              // Functional update: several toggles in one tick must each see the
              // previous result, not the array from the last render.
              setCollapsed((prev) =>
                prev.includes(account.id) ? prev.filter((id) => id !== account.id) : [...prev, account.id],
              )
            }
            readOnly={readOnly}
            onLaunch={onLaunch}
            onOpenAdset={onOpenAdset}
            onResult={setResult}
          />
        ))
      )}
    </>
  )
}

function AccountContainer({
  account,
  campaigns,
  view,
  open,
  onToggle,
  readOnly,
  onLaunch,
  onOpenAdset,
  onResult,
}: {
  account: AdAccount
  campaigns: Campaign[]
  view: View
  open: boolean
  onToggle: () => void
  readOnly: boolean
  onLaunch?: (intent: LaunchIntent) => void
  onOpenAdset: (adsetId: string) => void
  onResult: (text: string) => void
}) {
  const { db } = useStore()
  const bento = view === 'bento'

  return (
    <div
      className={cn(
        'mb-3 border border-line bg-surface shadow-highlight overflow-hidden',
        bento ? 'rounded-2xl' : 'rounded-xl',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 pl-3 pr-2.5 py-1 bg-bg-subtle transition-colors hover:bg-bg-subtle-2',
          open && 'border-b border-line',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2.5 flex-1 min-w-0 h-8 text-left cursor-pointer"
        >
          <span className="w-2.5 shrink-0 text-fg-tertiary">{open ? '▾' : '▸'}</span>
          <span className={cn(mono, 'truncate font-medium text-[12.5px]')}>
            {account.displayName}
          </span>
          <span className="text-fg-tertiary whitespace-nowrap">
            {account.supplierRef ?? account.store}
          </span>
          {isAccountProblem(account.status) && (
            <span title={account.statusReason}>
              <AccountStatusChip status={account.status} />
            </span>
          )}
          {!account.adAccountNumber && <Chip tone="danger">no account number</Chip>}
          <span className="ml-auto text-fg-secondary whitespace-nowrap">
            {campaigns.length} {campaigns.length === 1 ? 'CBO' : 'CBOs'}
          </span>
        </button>
        {!readOnly && onLaunch && (
          <Button size="sm" onClick={() => onLaunch({ adAccountId: account.id })}>
            + Launch here
          </Button>
        )}
      </div>

      {open && (
        <div
          className={cn(
            'grid gap-2 p-2.5',
            bento
              ? // Bento: fixed 12-col mosaic, dense packing fills the holes.
                'grid-cols-12 auto-rows-[minmax(0,auto)] grid-flow-dense'
              : 'grid-cols-[repeat(auto-fill,minmax(340px,1fr))] max-[900px]:grid-cols-1',
          )}
        >
          {campaigns.length === 0 && (
            <p className="m-0 text-fg-secondary col-span-full">
              No campaigns in this account yet.
            </p>
          )}
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              bento={bento}
              span={bento ? bentoSpan(slotsUsed(db, campaign.id)) : undefined}
              readOnly={readOnly}
              onLaunch={onLaunch}
              onOpenAdset={onOpenAdset}
              onResult={onResult}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Bento sizing: a tile's width follows how much is in it. Empty and single-ad-set
 * CBOs are small; three-or-more are wide so the full ones dominate the mosaic.
 * On a 12-column grid: 3 → four across, 4 → three across, 6 → two across.
 */
function bentoSpan(used: number): string {
  if (used >= 3) return 'col-span-12 sm:col-span-6 xl:col-span-6'
  if (used === 2) return 'col-span-12 sm:col-span-6 xl:col-span-4'
  return 'col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3'
}

function CampaignCard({
  campaign,
  bento,
  span,
  readOnly,
  onLaunch,
  onOpenAdset,
  onResult,
}: {
  campaign: Campaign
  bento: boolean
  span?: string
  readOnly: boolean
  onLaunch?: (intent: LaunchIntent) => void
  onOpenAdset: (adsetId: string) => void
  onResult: (text: string) => void
}) {
  const { db } = useStore()
  const { nextBatch, setCampaignHold, setCampaignKilled } = useActions()
  const killed = campaign.status === 'KILLED'
  // A killed CBO has no live ad sets; its card shows the ones that went down with it.
  const live = killed ? adsetsInCampaign(db, campaign.id) : liveAdsets(db, campaign.id)
  const costCap = isCostCapCampaign(campaign.name)
  const held = Boolean(campaign.onHold) || costCap
  const history = adsetsInCampaign(db, campaign.id).filter(
    (a) => !OCCUPYING_STATUSES.includes(a.status),
  )
  const used = slotsUsed(db, campaign.id)
  const full = isCampaignFull(db, campaign.id)
  const product = db.products.find((p) => p.id === campaign.productId)
  const [showHistory, setShowHistory] = useState(false)

  // In bento, wide tiles lay their ad sets out two-up so the tile stays short.
  const twoUp = bento && used >= 3

  return (
    <article
      className={cn(
        'flex flex-col border border-line border-l-2 bg-surface-raised shadow-highlight transition-colors hover:border-line-strong',
        bento ? 'rounded-xl' : 'rounded-lg',
        killed && 'opacity-70 border-dashed',
        span,
      )}
      style={{ borderLeftColor: CAMPAIGN_TYPE_COLOR[campaign.campaignType] }}
    >
      <div className="flex items-baseline gap-2 px-3 py-2">
        <span className={cn(mono, 'truncate text-[13px] font-medium')} title={campaign.name}>
          {campaign.name}
        </span>
        <CampaignTypeChip type={campaign.campaignType} />
        {costCap ? (
          <Chip tone="warn" title="Cost-cap CBO — tuned by hand. Next batch and the bulk trigger never touch it; launch into it from the drawer if you mean to.">
            $ Cost cap
          </Chip>
        ) : (
          held && (
            <Chip tone="warn" title="Still running in Meta; the team no longer launches new ad sets into it.">
              ⏸ On hold
            </Chip>
          )
        )}
        {killed && (
          <Chip tone="danger" title={campaign.killedAt ? `Killed ${new Date(campaign.killedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Killed'}>
            ☠ Killed
          </Chip>
        )}
        <span
          className={cn(
            'ml-auto text-[11px] whitespace-nowrap',
            full ? 'text-fg font-medium' : 'text-fg-secondary',
          )}
        >
          {used > MAX_ADSETS_PER_CAMPAIGN ? `${used} adsets` : `${used} / ${MAX_ADSETS_PER_CAMPAIGN} adsets`}
        </span>
      </div>

      <div className={cn('border-t border-line', twoUp && 'grid grid-cols-2')}>
        {live.map((adset) => (
          <AdsetRow key={adset.id} adset={adset} onOpen={() => onOpenAdset(adset.id)} twoUp={twoUp} muted={killed} />
        ))}
        {Array.from({ length: killed ? 0 : Math.max(0, MAX_ADSETS_PER_CAMPAIGN - used) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className={cn(
              'flex items-center min-h-[30px] px-3 py-1 border-b border-line text-xs text-fg-tertiary',
              twoUp && 'odd:border-r',
              !twoUp && 'last:border-b-0',
            )}
          >
            open slot
          </div>
        ))}
        {showHistory &&
          history.map((adset) => (
            <AdsetRow
              key={adset.id}
              adset={adset}
              onOpen={() => onOpenAdset(adset.id)}
              muted
              twoUp={twoUp}
            />
          ))}
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-line bg-bg-subtle mt-auto">
        {readOnly || !onLaunch ? (
          <span className="text-fg-secondary">
            {product?.name}
            {history.length > 0 && (
              <>
                <span className="px-1.5 text-line-strong">·</span>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory((s) => !s)}>
                  {showHistory ? 'Hide history' : `${history.length} in history`}
                </Button>
              </>
            )}
          </span>
        ) : killed ? (
          <>
            <span className="text-xs text-fg-secondary">
              Switched off{campaign.killedBy ? ` by ${db.users.find((u) => u.id === campaign.killedBy)?.name ?? 'Charles'}` : ''}. Its ad sets are in the Library.
            </span>
            <span className="flex-1" />
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm(`Bring ${campaign.name} back? Its ad sets return as live and it rejoins the workspace.`)) {
                  if (setCampaignKilled(campaign.id, false)) onResult(`${campaign.name} is back in the workspace.`)
                }
              }}
            >
              ↩ Revive
            </Button>
          </>
        ) : (
          <>
            {held ? (
              <>
                <span className="text-xs text-fg-secondary">No new ad sets here</span>
                <Button
                  size="sm"
                  onClick={() =>
                    onLaunch({
                      adAccountId: campaign.adAccountId,
                      forceNewCampaign: true,
                      sourceKind: 'EXISTING_ADSET',
                    })
                  }
                >
                  Launch from this
                </Button>
              </>
            ) : full ? (
              <>
                <Chip>Campaign full</Chip>
                <Button
                  size="sm"
                  onClick={() =>
                    onLaunch({
                      adAccountId: campaign.adAccountId,
                      forceNewCampaign: true,
                      sourceKind: 'EXISTING_ADSET',
                    })
                  }
                >
                  Launch from this
                </Button>
              </>
            ) : (
              <>
                <NextBatchButton campaignId={campaign.id} onResult={onResult} onLaunch={nextBatch} />
                <Button
                  size="sm"
                  onClick={() =>
                    onLaunch({
                      adAccountId: campaign.adAccountId,
                      destinationCampaignId: campaign.id,
                    })
                  }
                >
                  Launch…
                </Button>
              </>
            )}
            <span className="flex-1" />
            <OverflowMenu
              entries={[
                {
                  label: 'New CBO for this product',
                  onClick: () =>
                    onLaunch({ adAccountId: campaign.adAccountId, forceNewCampaign: true }),
                },
                {
                  label: 'Reuse an old batch here',
                  disabled: full || held,
                  disabledReason: held ? 'This CBO is on hold.' : 'This CBO is full.',
                  onClick: () =>
                    onLaunch({
                      adAccountId: campaign.adAccountId,
                      destinationCampaignId: campaign.id,
                      sourceKind: 'OLD_ADSET',
                      creativeHandling: 'REUSE_EXACT',
                    }),
                },
                {
                  label: 'Create deep iteration',
                  onClick: () =>
                    onLaunch({
                      adAccountId: campaign.adAccountId,
                      sourceKind: 'EXISTING_ADSET',
                      creativeHandling: 'DEEP_ITERATION',
                      campaignType: 'DIT',
                      conceptType: 'DEEP_ITERATION',
                      forceNewCampaign: true,
                    }),
                },
                {
                  label: held ? '▶ Resume new ad sets here' : '⏸ Stop new ad sets here',
                  separatorBefore: true,
                  disabled: costCap,
                  disabledReason: 'Cost-cap CBOs are recognised by their name and always kept off the trigger.',
                  onClick: () => {
                    if (setCampaignHold(campaign.id, !held)) {
                      onResult(
                        held
                          ? `${campaign.name} resumed — Next batch can target it again.`
                          : `${campaign.name} on hold — it keeps running in Meta, but Next batch and the bulk trigger skip it.`,
                      )
                    }
                  },
                },
                {
                  label: '☠ Mark as killed',
                  danger: true,
                  onClick: () => {
                    if (
                      window.confirm(
                        `Kill ${campaign.name}? It leaves the workspace and its ${used} live ad ${used === 1 ? 'set' : 'sets'} move to the Library as killed. You can revive it from the Killed filter.`,
                      )
                    ) {
                      if (setCampaignKilled(campaign.id, true)) {
                        onResult(`${campaign.name} marked as killed — find it under the Killed filter, or its ad sets in the Library.`)
                      }
                    }
                  },
                },
                {
                  label: showHistory ? 'Hide history' : `Show history (${history.length})`,
                  disabled: history.length === 0,
                  disabledReason: 'Nothing in history for this CBO.',
                  onClick: () => setShowHistory((s) => !s),
                },
              ]}
            />
          </>
        )}
      </div>
    </article>
  )
}

/**
 * The one-click action. The tooltip says exactly what it will create — modelled
 * on which ad set, named what, how many creatives — so there is nothing to
 * confirm. Click, done.
 */
function NextBatchButton({
  campaignId,
  onResult,
  onLaunch,
}: {
  campaignId: string
  onResult: (text: string) => void
  onLaunch: (ids: string[]) => boolean
}) {
  const { db } = useStore()
  const plan = planNextBatch(db, campaignId, now())
  const basis = plan.source ? `from ${plan.source.name}` : 'fresh Swipes + Playbook'
  return (
    <Button
      variant={plan.blockedReason ? 'default' : 'primary'}
      size="sm"
      disabled={Boolean(plan.blockedReason)}
      title={
        plan.blockedReason ??
        `${plan.warning ? `⚠ ${plan.warning}\n` : ''}Creates ${plan.adsetName} ${basis} · ${plan.quantity} creatives → Yzah, setup waits`
      }
      onClick={() => {
        if (onLaunch([campaignId])) {
          onResult(
            `${plan.campaign.name} → ${plan.adsetName} (${basis}) — Yzah task for ${plan.quantity} creatives, setup task waiting for creative.${plan.warning ? ` ⚠ ${plan.warning}` : ''}`,
          )
        }
      }}
    >
      {plan.blockedReason?.includes('in flight')
        ? '⏳ Batch in flight'
        : plan.blockedReason?.includes('days between batches')
          ? '⏳ Too soon'
          : '⚡ Next batch'}
    </Button>
  )
}

function AdsetRow({
  adset,
  onOpen,
  muted,
  twoUp,
}: {
  adset: Adset
  onOpen: () => void
  muted?: boolean
  twoUp?: boolean
}) {
  const { db } = useStore()
  const source = adset.sourceAdsetId
    ? db.adsets.find((a) => a.id === adset.sourceAdsetId)
    : undefined
  const placeholder = isPlaceholderAdset(adset)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'flex items-center gap-2 min-h-[30px] px-3 py-1 border-b border-line cursor-pointer transition-colors hover:bg-surface-hover',
        twoUp && 'odd:border-r',
        !twoUp && 'last:border-b-0',
        muted && 'opacity-55',
      )}
    >
      <span
        className={cn(mono, 'truncate min-w-0', placeholder && 'italic text-fg-tertiary')}
        title={placeholder ? 'Stand-in until the real ad-set names are imported.' : adset.name}
      >
        {adset.name}
      </span>
      <span className="ml-auto flex items-center gap-1.5 shrink-0">
        {source && (
          <Chip tone="quiet" title={`Source: ${source.name}`}>
            ↩ {source.name.slice(0, 8)}
          </Chip>
        )}
        {placeholder ? <Chip tone="quiet">placeholder</Chip> : <AdsetStatusChip status={adset.status} />}
      </span>
    </div>
  )
}

/**
 * Flat view of every ad set in the selected country — for scanning rather than
 * deciding. Slot pressure is a column here instead of the headline.
 */
function AdsetTable({
  groups,
  onOpenAdset,
}: {
  groups: { account: AdAccount; campaigns: Campaign[] }[]
  onOpenAdset: (adsetId: string) => void
}) {
  const { db } = useStore()

  // One block per CBO: the account, campaign, type and slots are written once,
  // then its ad sets underneath. A CBO with eight ad sets is eight short rows,
  // not eight copies of the same header.
  const blocks = groups.flatMap(({ account, campaigns }) =>
    campaigns.map((campaign) => ({
      account,
      campaign,
      used: slotsUsed(db, campaign.id),
      adsets: (campaign.status === 'KILLED' ? adsetsInCampaign(db, campaign.id) : liveAdsets(db, campaign.id)).map((adset) => ({
        adset,
        source: adset.sourceAdsetId ? db.adsets.find((a) => a.id === adset.sourceAdsetId) : undefined,
      })),
    })),
  )

  if (blocks.every((b) => b.adsets.length === 0)) {
    return <EmptyState title="No live ad sets in this country." />
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Ad Account</Th>
          <Th>Campaign</Th>
          <Th>Type</Th>
          <Th>Ad Set</Th>
          <Th>Slots</Th>
          <Th>Source</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {blocks.map(({ account, campaign, used, adsets }) =>
          adsets.map(({ adset, source }, i) => {
            const first = i === 0
            return (
              <Tr
                key={adset.id}
                onClick={() => onOpenAdset(adset.id)}
                className={cn(first && i > -1 && 'border-t-2 border-t-line-strong')}
              >
                {first ? (
                  <>
                    <NameTd value={account.displayName} />
                    <NameTd value={campaign.name} />
                    <Td className="whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <CampaignTypeChip type={campaign.campaignType} />
                        {campaign.onHold && <Chip tone="warn">⏸ On hold</Chip>}
                        {campaign.status === 'KILLED' && <Chip tone="danger">☠ Killed</Chip>}
                      </span>
                    </Td>
                  </>
                ) : (
                  <>
                    <Td className="text-fg-tertiary" />
                    <Td className="text-fg-tertiary">
                      <span className="pl-2 text-xs">↳</span>
                    </Td>
                    <Td />
                  </>
                )}
                {isPlaceholderAdset(adset) ? (
                  <Td className="italic text-fg-tertiary">{adset.name}</Td>
                ) : (
                  <NameTd value={adset.name} />
                )}
                <Td className="whitespace-nowrap text-fg-secondary">
                  {first ? (used > MAX_ADSETS_PER_CAMPAIGN ? `${used} (over)` : `${used}/${MAX_ADSETS_PER_CAMPAIGN}`) : ''}
                </Td>
                <NameTd value={source ? `↩ ${source.name}` : '—'} muted />
                <Td className="whitespace-nowrap">
                  {isPlaceholderAdset(adset) ? <Chip tone="quiet">placeholder</Chip> : <AdsetStatusChip status={adset.status} />}
                </Td>
              </Tr>
            )
          }),
        )}
      </tbody>
    </TableWrap>
  )
}
