// Launch Library (PRD §7.5) — a historical list, not an analytics screen. Two
// views: the old/killed ad sets, and the reusable creative batches behind them
// (§7.1: a batch is never permanently bound to one ad set).

import { useState } from 'react'

import {
  Block,
  Button,
  Chip,
  cn,
  EmptyState,
  inputClass,
  LinkButton,
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
} from '../components/ui'
import { AdsetStatusChip, CONCEPT_TYPE_LABEL } from '../labels'
import { formatLaunchDate } from '../naming'
import { byId, libraryRows, reusableBatches } from '../selectors'
import { useStore } from '../store'
import type { LaunchIntent } from './LaunchDrawer'

type View = 'ADSETS' | 'BATCHES'

export function Library({
  onLaunch,
  onOpenAdset,
}: {
  onLaunch?: (intent: LaunchIntent) => void
  onOpenAdset: (adsetId: string) => void
}) {
  const { db, currentUser } = useStore()
  const [view, setView] = useState<View>('ADSETS')
  const [query, setQuery] = useState('')

  const canRelaunch = currentUser.role === 'MEDIA_BUYER' && Boolean(onLaunch)
  const q = query.trim().toLowerCase()

  const rows = libraryRows(db).filter(
    (r) =>
      !q ||
      r.product.name.toLowerCase().includes(q) ||
      r.campaign.name.toLowerCase().includes(q) ||
      r.adset.name.toLowerCase().includes(q),
  )

  const batches = reusableBatches(db).filter((b) => {
    if (!q) return true
    const product = byId(db.products, b.productId)
    return (product?.name ?? '').toLowerCase().includes(q)
  })

  return (
    <>
      <PageHead
        title="Launch Library"
        sub="Old, stopped and killed work that is still worth relaunching — plus the creative batches behind it."
      />

      <Toolbar>
        <Segmented
          ariaLabel="View"
          value={view}
          options={[
            { value: 'ADSETS' as View, label: `Old / killed (${libraryRows(db).length})` },
            { value: 'BATCHES' as View, label: `Creative batches (${reusableBatches(db).length})` },
          ]}
          onChange={setView}
        />
        <input
          className={cn(inputClass, 'min-w-[200px] flex-[0_1_280px]')}
          placeholder="Search product / campaign…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Toolbar>

      {view === 'ADSETS' &&
        (rows.length === 0 ? (
          <EmptyState
            title="No old/killed batches found for this product."
            hint="Try another product or clear the filter."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Product</Th>
                <Th>Type</Th>
                <Th>Original campaign</Th>
                <Th>Original ad set</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.adset.id} onClick={() => onOpenAdset(r.adset.id)}>
                  <Td className={cn(mono, 'whitespace-nowrap')}>
                    {r.adset.launchedAt ? formatLaunchDate(new Date(r.adset.launchedAt)) : r.adset.name.slice(0, 8)}
                  </Td>
                  <Td className="whitespace-nowrap">{r.product.name}</Td>
                  <Td className="whitespace-nowrap text-fg-secondary">{CONCEPT_TYPE_LABEL[r.adset.conceptType]}</Td>
                  <NameTd value={r.campaign.name} />
                  <NameTd value={r.adset.name} />
                  <Td className="whitespace-nowrap">
                    <AdsetStatusChip status={r.adset.status} />
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canRelaunch ? (
                      <div className="inline-flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            onLaunch!({
                              sourceKind: 'OLD_ADSET',
                              sourceAdsetId: r.adset.id,
                              creativeHandling: 'REUSE_EXACT',
                              adAccountId: r.account.id,
                              forceNewCampaign: true,
                              campaignType: 'REL',
                            })
                          }
                        >
                          {r.adset.status === 'KILLED' ? 'Relaunch' : 'Reuse'}
                        </Button>
                        <OverflowMenu
                          entries={[
                            {
                              label: 'Reuse in another CBO',
                              onClick: () =>
                                onLaunch!({ sourceKind: 'OLD_ADSET', sourceAdsetId: r.adset.id, creativeHandling: 'REUSE_EXACT' }),
                            },
                            {
                              label: 'Reuse + add new creatives',
                              onClick: () =>
                                onLaunch!({ sourceKind: 'OLD_ADSET', sourceAdsetId: r.adset.id, creativeHandling: 'REUSE_PLUS_NEW' }),
                            },
                            {
                              label: 'Create deep iteration',
                              onClick: () =>
                                onLaunch!({
                                  sourceKind: 'OLD_ADSET',
                                  sourceAdsetId: r.adset.id,
                                  creativeHandling: 'DEEP_ITERATION',
                                  campaignType: 'DIT',
                                  conceptType: 'DEEP_ITERATION',
                                  forceNewCampaign: true,
                                }),
                            },
                            { label: 'View details', separatorBefore: true, onClick: () => onOpenAdset(r.adset.id) },
                          ]}
                        />
                      </div>
                    ) : r.batch?.driveUrl ? (
                      <a href={r.batch.driveUrl} target="_blank" rel="noreferrer" className="border-b border-line-strong hover:border-fg">
                        Drive
                      </a>
                    ) : (
                      <span className="text-fg-tertiary">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        ))}

      {view === 'BATCHES' &&
        (batches.length === 0 ? (
          <EmptyState title="No submitted creative batches yet." />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-2.5">
            {batches.map((b) => {
              const product = byId(db.products, b.productId)
              const usedBy = db.adsets
                .filter((a) => a.creativeBatchId === b.id)
                .map((a) => ({ adset: a, campaign: byId(db.campaigns, a.campaignId) }))
              return (
                <article key={b.id} className="border border-line rounded-xl bg-surface shadow-highlight overflow-hidden">
                  <div className="px-3.5 py-[13px]">
                    <div className="font-semibold mb-[3px]">
                      {product?.name} · {CONCEPT_TYPE_LABEL[b.type]}
                    </div>
                    <div className="text-fg-secondary">
                      {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="px-1.5 text-line-strong">·</span>
                      {b.hooks.length} hooks
                      <span className="px-1.5 text-line-strong">·</span>
                      {usedBy.length} {usedBy.length === 1 ? 'use' : 'uses'}
                    </div>
                    <Block className="mt-2.5">
                      {usedBy.map(({ adset, campaign }) => `${campaign?.name ?? '—'} → ${adset.name}`).join('\n') ||
                        'Not used yet.'}
                    </Block>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-t border-line bg-bg-subtle">
                    {b.driveUrl && <LinkButton href={b.driveUrl}>Open Drive</LinkButton>}
                    <span className="flex-1" />
                    {canRelaunch ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onLaunch!({ sourceKind: 'EXISTING_BATCH', sourceBatchId: b.id, creativeHandling: 'REUSE_EXACT' })}
                      >
                        Launch with this batch
                      </Button>
                    ) : (
                      <Chip tone="quiet">source links only</Chip>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ))}
    </>
  )
}
