// Ad-set detail. Reached from the workspace, the library, Danny's day view and
// Mark's history — read-only for everyone except Charles, who also gets the §7.6
// quick actions.

import {
  Block,
  Button,
  Callout,
  Chip,
  cn,
  CopyButton,
  CopyRow,
  Drawer,
  hintClass,
  labelClass,
  LinkButton,
  mono,
  OverflowMenu,
  Section,
  TextRow,
} from '../components/ui'
import {
  AdsetStatusChip,
  CONCEPT_TYPE_LABEL,
  CreativeStatusChip,
  LAUNCH_MODE_LABEL,
  PriorityChip,
  SetupStatusChip,
} from '../labels'
import { formatTime, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { isCampaignFull, rowForAdset, slotsUsed, userName } from '../selectors'
import { useActions, useStore } from '../store'
import type { LaunchIntent } from './LaunchDrawer'

const Dot = () => <span className="px-1.5 text-line-strong">·</span>

/**
 * An ad set that exists in Meta but was never launched through this app — the
 * seeded book, or anything imported later. No brief, no lineage, no tasks; just
 * the exact names and a way to launch the next batch into its CBO.
 */
function ImportedAdsetDrawer({
  adsetId,
  onClose,
  onLaunch,
}: {
  adsetId: string
  onClose: () => void
  onLaunch?: (intent: LaunchIntent) => void
}) {
  const { db, currentUser } = useStore()
  const adset = db.adsets.find((a) => a.id === adsetId)
  const campaign = adset ? db.campaigns.find((c) => c.id === adset.campaignId) : undefined
  const account = campaign ? db.adAccounts.find((a) => a.id === campaign.adAccountId) : undefined
  const product = campaign ? db.products.find((p) => p.id === campaign.productId) : undefined

  if (!adset || !campaign || !account) {
    return (
      <Drawer title="Ad set" onClose={onClose}>
        <p className="text-fg-secondary">This ad set no longer exists.</p>
      </Drawer>
    )
  }

  const full = isCampaignFull(db, campaign.id)
  const isCharles = currentUser.role === 'MEDIA_BUYER'

  return (
    <Drawer
      title={adset.name}
      subtitle={
        <>
          <span className={mono}>{campaign.name}</span>
          <Dot />
          {product?.name}
        </>
      }
      onClose={onClose}
      footer={
        isCharles && onLaunch ? (
          <>
            <Button
              variant="primary"
              onClick={() =>
                onLaunch({
                  adAccountId: account.id,
                  destinationCampaignId: full ? undefined : campaign.id,
                  forceNewCampaign: full,
                })
              }
            >
              {full ? 'Launch from this into a new CBO' : 'Launch into this CBO'}
            </Button>
          </>
        ) : undefined
      }
    >
      <Callout>
        <strong>Imported from Meta.</strong> This ad set was running before Campaign
        Launcher — there is no brief, source or task history for it here. Send the real
        ad-set name and it will replace this placeholder.
      </Callout>
      <Section title="Names">
        <CopyRow label="Ad account" value={account.displayName} />
        <CopyRow label="Campaign" value={campaign.name} />
        <CopyRow label="Ad set" value={adset.name} />
        <div className="mt-2.5 text-fg-secondary">
          <AdsetStatusChip status={adset.status} />
          <Dot />
          {slotsUsed(db, campaign.id)}/{MAX_ADSETS_PER_CAMPAIGN} slots used
        </div>
      </Section>
    </Drawer>
  )
}

export function AdsetDrawer({
  adsetId,
  onClose,
  onLaunch,
}: {
  adsetId: string
  onClose: () => void
  onLaunch?: (intent: LaunchIntent) => void
}) {
  const { db, currentUser } = useStore()
  const { archiveAdset, cancelLaunch } = useActions()
  const row = rowForAdset(db, adsetId)

  if (!row) return <ImportedAdsetDrawer adsetId={adsetId} onClose={onClose} onLaunch={onLaunch} />

  const isCharles = currentUser.role === 'MEDIA_BUYER'
  const campaignFull = isCampaignFull(db, row.campaign.id)
  const { batch, creativeTask, setupTask, sourceAdset, sourceCampaign } = row

  // Anything not yet live can be cancelled. A submitted batch survives in the
  // Library; the ad set, launch and tasks go.
  const cancellable = row.adset.status === 'PLANNED'
  const cancelLaunchWithConfirm = () => {
    const kept = batch?.driveUrl ? ' The creative batch stays in the Library.' : ''
    if (
      window.confirm(
        `Cancel ${row.adset.name} in ${row.campaign.name}? The ad set and its tasks are removed — nothing has gone live.${kept}`,
      )
    ) {
      if (cancelLaunch(row.adset.id)) onClose()
    }
  }

  const quickActions = onLaunch
    ? [
        ...(cancellable ? [{ label: 'Cancel this launch', onClick: cancelLaunchWithConfirm }] : []),
        {
          label: 'Reuse in another CBO',
          onClick: () =>
            onLaunch({ sourceKind: 'EXISTING_ADSET', sourceAdsetId: row.adset.id, creativeHandling: 'REUSE_EXACT' }),
        },
        {
          label: 'Clone into new CBO',
          onClick: () =>
            onLaunch({
              sourceKind: 'EXISTING_ADSET',
              sourceAdsetId: row.adset.id,
              creativeHandling: 'REUSE_EXACT',
              forceNewCampaign: true,
            }),
        },
        {
          label: 'Create deep iteration',
          onClick: () =>
            onLaunch({
              sourceKind: 'EXISTING_ADSET',
              sourceAdsetId: row.adset.id,
              creativeHandling: 'DEEP_ITERATION',
              campaignType: 'DIT',
              conceptType: 'DEEP_ITERATION',
              forceNewCampaign: campaignFull, // §16.3 — a full source CBO forces a new one
            }),
        },
        {
          label: 'Archive ad set',
          separatorBefore: true,
          disabled: cancellable,
          disabledReason: 'Cancel this launch instead — nothing has gone live.',
          onClick: () => {
            if (
              window.confirm(
                `Archive ${row.adset.name}? It leaves the workspace and frees a slot in ${row.campaign.name}.`,
              )
            ) {
              archiveAdset(row.adset.id)
              onClose()
            }
          },
        },
      ]
    : []

  return (
    <Drawer
      title={row.adset.name}
      subtitle={
        <>
          <span className={mono}>{row.campaign.name}</span>
          <Dot />
          {row.product.name}
          <Dot />
          {row.countryCode}
        </>
      }
      onClose={onClose}
      footer={
        isCharles && onLaunch ? (
          <>
            {cancellable && (
              <Button variant="danger" onClick={cancelLaunchWithConfirm}>
                Cancel launch
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() =>
                onLaunch({
                  sourceKind: 'EXISTING_ADSET',
                  sourceAdsetId: row.adset.id,
                  destinationCampaignId: campaignFull ? undefined : row.campaign.id,
                  forceNewCampaign: campaignFull,
                  creativeHandling: 'REUSE_EXACT',
                })
              }
            >
              {campaignFull ? 'Launch from this into a new CBO' : 'Launch into this CBO'}
            </Button>
            <span className="flex-1" />
            <OverflowMenu entries={quickActions} />
          </>
        ) : undefined
      }
    >
      <Section title="Destination">
        <CopyRow label="Ad account" value={row.account.displayName} />
        <CopyRow label="Campaign" value={row.campaign.name} />
        <CopyRow label="Ad set" value={row.adset.name} />
        <div className="mt-2.5 text-fg-secondary">
          <AdsetStatusChip status={row.adset.status} />
          <Dot />
          {CONCEPT_TYPE_LABEL[row.adset.conceptType]}
          <Dot />
          {LAUNCH_MODE_LABEL[row.launch.launchMode]}
          <Dot />
          {slotsUsed(db, row.campaign.id)}/{MAX_ADSETS_PER_CAMPAIGN} slots used
          {row.adset.launchedAt && (
            <>
              <Dot />
              launched{' '}
              {new Date(row.adset.launchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
              {formatTime(row.adset.launchedAt)}
            </>
          )}
        </div>
      </Section>

      {sourceAdset && sourceCampaign && (
        <Section title="Source history">
          <Block>
            {[
              `SOURCE CAMPAIGN  ${sourceCampaign.name}`,
              `SOURCE AD SET    ${sourceAdset.name}   ${sourceAdset.status.toLowerCase()}`,
              `DESTINATION      ${row.campaign.name} → ${row.adset.name}`,
            ].join('\n')}
          </Block>
          <div className={hintClass}>
            The source date stays here as history. It never becomes the destination date.
          </div>
        </Section>
      )}

      {batch && (
        <Section
          title="Creative brief"
          trailing={
            batch.driveUrl ? (
              <LinkButton href={batch.driveUrl}>Open Drive</LinkButton>
            ) : (
              <span className="text-fg-tertiary">Not submitted yet</span>
            )
          }
        >
          {batch.hooks.length > 0 && (
            <div className="mb-3">
              <div className={labelClass}>Hooks</div>
              {batch.hooks.map((h, i) => (
                <TextRow key={i} copy={h}>
                  {h}
                </TextRow>
              ))}
              <CopyButton value={batch.hooks.join('\n')} label="Copy all hooks" />
            </div>
          )}
          {batch.angle && (
            <p className="mt-0 mb-3 text-fg-secondary">
              <strong className="text-fg font-medium">Angle:</strong> {batch.angle}
            </p>
          )}
          {batch.direction && <Block>{batch.direction}</Block>}
          {batch.references.length > 0 && (
            <div className="mt-3">
              <div className={labelClass}>References</div>
              <ul className="m-0 pl-[18px]">
                {batch.references.map((r, i) => (
                  <li key={i} className="mb-[3px]">
                    <a href={r.url} target="_blank" rel="noreferrer" className="border-b border-line-strong hover:border-fg">
                      {r.label ?? r.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section title="Tasks">
        <div className={cn('flex items-center gap-2 px-[11px] py-2.5 mb-2 border border-line rounded-lg bg-surface')}>
          <div className="min-w-0 text-[13px]">
            <span className={cn(labelClass, 'mb-[3px] text-[10.5px] text-fg-tertiary')}>
              Creative{creativeTask && ` · ${userName(db, creativeTask.assignee)}`}
            </span>
            {creativeTask ? (
              <>
                {creativeTask.quantity} creatives
                {creativeTask.submittedAt && ` · submitted ${formatTime(creativeTask.submittedAt)}`}
              </>
            ) : (
              'No creative task — the source batch is reused exactly.'
            )}
          </div>
          {creativeTask && (
            <div className="ml-auto flex gap-1.5 shrink-0">
              <PriorityChip priority={creativeTask.priority} />
              <CreativeStatusChip status={creativeTask.status} />
            </div>
          )}
        </div>
        {setupTask && (
          <div className="flex items-center gap-2 px-[11px] py-2.5 mb-2 border border-line rounded-lg bg-surface">
            <div className="min-w-0 text-[13px]">
              <span className={cn(labelClass, 'mb-[3px] text-[10.5px] text-fg-tertiary')}>
                Setup{setupTask.completedBy && ` · ${userName(db, setupTask.completedBy)}`}
              </span>
              {setupTask.completedAt
                ? `Completed ${formatTime(setupTask.completedAt)}`
                : `Due ${new Date(setupTask.dueAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
            </div>
            <div className="ml-auto flex gap-1.5 shrink-0">
              {setupTask.checkedAt && (
                <Chip tone="success" title={`QA checked by ${userName(db, setupTask.checkedBy)}`}>
                  ✓ QA
                </Chip>
              )}
              <SetupStatusChip status={setupTask.status} />
            </div>
          </div>
        )}
      </Section>
    </Drawer>
  )
}
