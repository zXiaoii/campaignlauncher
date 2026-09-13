// 48-hour follow-up helper (PRD §13). Time-based only: it reminds Charles that
// enough time has passed to consider the next task. No CPA, ROAS, spend, scoring
// or recommendation logic exists anywhere in this file by design (§13.4).

import { now } from '../clock'
import { Block, Button, Callout, cn, EmptyState, mono, PageHead } from '../components/ui'
import { formatLaunchDate, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { followupCandidates } from '../selectors'
import { useActions, useStore } from '../store'
import type { LaunchIntent } from './LaunchDrawer'

export function Followups({
  onLaunch,
  onOpenLibrary,
}: {
  onLaunch: (intent: LaunchIntent) => void
  onOpenLibrary: () => void
}) {
  const { db } = useStore()
  const { dismissFollowup } = useActions()
  const candidates = followupCandidates(db, now())

  return (
    <>
      <PageHead
        title="48H Follow-ups"
        sub="Ad sets that have been live for more than 48 hours. A reminder to decide the next action — not a performance recommendation."
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="No 48H follow-ups."
          hint="Nothing currently needs a time-based follow-up."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-2.5">
          {candidates.map(({ row, eligibleAt, slotsUsed, isFull }) => (
            <article
              key={row.adset.id}
              className="border border-line rounded-xl bg-surface shadow-highlight overflow-hidden"
            >
              <div className="px-3.5 py-[13px]">
                <div className="font-semibold mb-[3px]">{row.product.name}</div>
                <div className={cn(mono, 'text-fg-secondary')}>{row.campaign.name}</div>
                <div className="text-fg-secondary">{row.account.displayName}</div>
                <Block className="mt-2.5">
                  {[
                    `SOURCE DESTINATION  ${row.adset.name}`,
                    `LAUNCHED            ${formatLaunchDate(new Date(row.adset.launchedAt!))}`,
                    `48H PASSED          ${formatLaunchDate(new Date(eligibleAt))}`,
                    `CAMPAIGN SLOTS      ${slotsUsed} / ${MAX_ADSETS_PER_CAMPAIGN}`,
                  ].join('\n')}
                </Block>
                {isFull && (
                  <p className="mt-2.5 mb-0 text-fg-secondary">
                    <strong className="text-fg font-medium">This CBO is full.</strong>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-t border-line bg-bg-subtle">
                {isFull ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        onLaunch({
                          sourceKind: 'EXISTING_ADSET',
                          sourceAdsetId: row.adset.id,
                          adAccountId: row.account.id,
                          forceNewCampaign: true,
                          creativeHandling: 'REUSE_EXACT',
                        })
                      }
                    >
                      + New CBO from this
                    </Button>
                    <Button size="sm" onClick={onOpenLibrary}>
                      Open Library
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        onLaunch({
                          adAccountId: row.account.id,
                          destinationCampaignId: row.campaign.id,
                          sourceKind: 'NEW_BATCH',
                        })
                      }
                    >
                      + Launch into this CBO
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        onLaunch({
                          adAccountId: row.account.id,
                          destinationCampaignId: row.campaign.id,
                          sourceKind: 'OLD_ADSET',
                          creativeHandling: 'REUSE_EXACT',
                        })
                      }
                    >
                      Reuse old batch
                    </Button>
                  </>
                )}
                <span className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => dismissFollowup(row.adset.id)}>
                  Dismiss
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Callout className="mt-5">
        <strong>Scope.</strong> No CPA/ROAS/spend thresholds, scoring, &ldquo;push hard&rdquo;
        logic or AI performance recommendations. The helper only tracks elapsed time and
        campaign capacity.
      </Callout>
    </>
  )
}
