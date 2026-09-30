// Apply review — the ecom analyzer's workbook, uploaded as it is.
//
// Nothing is written until Charles presses Apply: the drawer reads the file, plans
// every change against the database as it stands, and shows the lot first — which
// CBOs get which verdict, which are marked killed, what is imported, and which test
// batches become tasks for Yzah and the setup team.

import { useMemo, useState } from 'react'

import { useToast } from '../components/Toaster'
import { Block, Button, Callout, Chip, cn, Drawer, Field, hintClass, mono, Section } from '../components/ui'
import { readXlsxSheets } from '../importing'
import { REVIEW_STATUS_TONE } from '../labels'
import { parseReview, planReview, type ParsedReview } from '../review'
import { useActions, useStore } from '../store'
import type { ReviewStatus } from '../types'

const ORDER: ReviewStatus[] = ['SCALE', 'HOLD', 'FIX', 'TESTING', 'WATCH', 'KILL', 'OFF']

export function ReviewDrawer({ onClose }: { onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { applyReview } = useActions()
  const { show } = useToast()

  const [parsed, setParsed] = useState<{ review: ParsedReview | null; error: string | null; fileName?: string }>({
    review: null,
    error: null,
  })
  const [kill, setKill] = useState(true)
  const [tests, setTests] = useState(true)

  const readFile = async (file: File) => {
    clearError()
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Upload the .xlsx workbook the analyzer produced ("Meta Ads Review …").')
      setParsed({ review: parseReview(await readXlsxSheets(await file.arrayBuffer())), error: null, fileName: file.name })
    } catch (e) {
      setParsed({ review: null, error: e instanceof Error ? e.message : String(e), fileName: file.name })
    }
  }

  const plan = useMemo(() => (parsed.review ? planReview(db, parsed.review, { kill, tests }) : null), [db, parsed.review, kill, tests])

  const newCbos = plan ? plan.groups.filter((g) => !g.problem && !g.existingId) : []
  const addedTo = plan ? plan.groups.filter((g) => !g.problem && g.existingId) : []
  const newAdsets = plan ? plan.groups.filter((g) => !g.problem).reduce((n, g) => n + g.adding.length, 0) : 0
  const newAccounts = plan ? [...new Set(newCbos.filter((g) => !g.accountId && g.newAccount).map((g) => g.newAccount!.displayName))] : []
  const readyTests = plan ? plan.tests.filter((t) => t.input) : []
  const skippedTests = plan ? plan.tests.filter((t) => !t.input) : []
  const verdicts = plan ? plan.input.statuses.length : 0
  const nothing = plan
    ? verdicts === 0 && plan.input.importItems.length === 0 && plan.input.kills.length === 0 && plan.input.tests.length === 0
    : true

  const apply = () => {
    if (!plan) return
    if (applyReview(plan.input)) {
      show({
        tone: 'success',
        kind: 'Review applied',
        title: plan.input.label,
        body: [
          `${verdicts} ${verdicts === 1 ? 'CBO' : 'CBOs'} updated`,
          plan.input.kills.length ? `${plan.input.kills.length} marked killed` : '',
          newCbos.length ? `${newCbos.length} new ${newCbos.length === 1 ? 'CBO' : 'CBOs'} imported` : '',
          plan.input.tests.length
            ? `${plan.input.tests.length} test ${plan.input.tests.length === 1 ? 'batch' : 'batches'} assigned to creative and setup`
            : '',
        ]
          .filter(Boolean)
          .join(', ') + '.',
        ms: 12000,
      })
      onClose()
    }
  }

  return (
    <Drawer
      wide
      title="Apply review"
      subtitle="The analyzer's Meta Ads Review workbook. Nothing changes until you press Apply."
      onClose={onClose}
      footer={
        <>
          <div className="min-w-0">
            <div className={cn(mono, 'truncate')}>{plan ? plan.input.label : 'No review loaded'}</div>
            <div className={cn(mono, 'truncate text-fg-tertiary')}>
              {plan
                ? `${verdicts} verdicts · ${plan.input.kills.length} kills · ${plan.input.tests.length} test batches · ${plan.input.importItems.length} imports`
                : 'Choose the .xlsx file'}
            </div>
          </div>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!plan || nothing} onClick={apply}>
            Apply review
          </Button>
        </>
      }
    >
      <Section n={1} title="The review workbook">
        <Field
          label="File"
          hint='The "Meta Ads Review <store> <dates>.xlsx" file, exactly as the analyzer gave it to you. It needs its Campaigns, Ads and New Tests tabs.'
        >
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-[13px] text-fg-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-line-strong file:bg-surface-raised file:text-fg file:text-[13px] file:cursor-pointer"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
            }}
          />
        </Field>
        {parsed.error && <Callout tone="danger">{parsed.error}</Callout>}
        {error && (
          <Callout tone="danger">
            {error}{' '}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </Callout>
        )}
        {plan && (
          <p className={hintClass}>
            {plan.review.store || 'Store'} · {plan.review.from} to {plan.review.to} · {plan.review.campaigns.length} campaigns ·{' '}
            {plan.review.ads.length} ad sets · {plan.review.tests.length} test batches
          </p>
        )}
      </Section>

      {plan && (
        <>
          <Section n={2} title="Campaign status">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {ORDER.filter((s) => plan.statusCounts[s]).map((s) => (
                <Chip key={s} tone={REVIEW_STATUS_TONE[s]}>
                  {s} {plan.statusCounts[s]}
                </Chip>
              ))}
              {verdicts === 0 && <span className="text-fg-secondary">None of the reviewed campaigns are in the app.</span>}
            </div>
            <p className={hintClass}>
              Each CBO gets its verdict as a chip on its card, with the real ROAS and the analyzer's actions on hover. A newer review
              replaces it.
            </p>
            <label className="flex items-start gap-2 mt-3 text-[13px] cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={kill} onChange={(e) => setKill(e.target.checked)} />
              <span>
                Mark the KILL campaigns as killed here ({plan.kills.length})
                <span className="block text-fg-tertiary text-xs">
                  They leave the workspace and no new batch can go into them. Revivable; history kept. Turning them off in Meta is still
                  the agency's job.
                </span>
              </span>
            </label>
            {kill && (plan.kills.length > 0 || plan.killBlocked.length > 0) && (
              <Block className="mt-2 max-h-48 overflow-auto">
                {[
                  ...plan.kills.map((k) => `☠ ${k.name}   · ${k.accountName}`),
                  ...plan.killBlocked.map((n) => `— ${n}: a launch is still in flight, left alone (cancel it first)`),
                ].join('\n')}
              </Block>
            )}
          </Section>

          <Section n={3} title="New test batches">
            <label className="flex items-start gap-2 mb-2.5 text-[13px] cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={tests} onChange={(e) => setTests(e.target.checked)} />
              <span>
                Create the test batches as launches ({readyTests.length})
                <span className="block text-fg-tertiary text-xs">
                  One task for Yzah (the variations, with the analyzer's brief) and one for setup (the ad set in the TEST ABO campaign)
                  per batch — due on the planned launch date.
                </span>
              </span>
            </label>
            {readyTests.length === 0 && skippedTests.length === 0 && (
              <span className="text-fg-secondary">This review has no test batches.</span>
            )}
            {tests &&
              readyTests.map((t) => (
                <div key={`${t.row.account}|${t.row.testCampaign}|${t.adsetName}`} className="px-3 py-2 mb-1.5 border border-line rounded-lg bg-surface">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={cn(mono, 'font-medium')}>{t.adsetName}</span>
                    <span className="text-fg-secondary">in</span>
                    <span className={mono}>{t.row.testCampaign}</span>
                    {t.createsCampaign && (
                      <Chip tone="accent" title="This campaign is not in the app yet — setup creates it in Meta with the first batch.">
                        ＋ new campaign
                      </Chip>
                    )}
                    <Chip tone={t.input!.priority === 'HIGH' ? 'rose' : t.input!.priority === 'LOW' ? 'quiet' : 'info'}>
                      {t.input!.priority.toLowerCase()}
                    </Chip>
                  </div>
                  <div className="mt-1 text-xs text-fg-secondary">
                    {t.accountName} · {t.row.variations} variations of {t.row.baseAds || '—'}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-tertiary">{t.row.brief}</div>
                </div>
              ))}
            {skippedTests.length > 0 && (
              <Block className="mt-2">
                {skippedTests.map((t) => `— ${t.row.adsetName} (${t.row.testCampaign}): ${t.problem}`).join('\n')}
              </Block>
            )}
          </Section>

          <Section n={4} title="Brought in from the review">
            {plan.input.importItems.length === 0 ? (
              <span className="text-fg-secondary">Every reviewed campaign and ad set is already in the app.</span>
            ) : (
              <>
                <p className="mb-2 text-[13px]">
                  {newCbos.length} new {newCbos.length === 1 ? 'CBO' : 'CBOs'}
                  {addedTo.length ? `, ad sets added to ${addedTo.length} existing` : ''}, {newAdsets} ad {newAdsets === 1 ? 'set' : 'sets'}
                  {newAccounts.length ? `, ${newAccounts.length} new ad ${newAccounts.length === 1 ? 'account' : 'accounts'}` : ''}.
                </p>
                <Block className="max-h-56 overflow-auto">
                  {plan.groups
                    .filter((g) => !g.problem)
                    .map(
                      (g) =>
                        `${g.existingId ? '+ into' : 'new   '} ${g.campaignName}${g.existingId ? '' : `   [${g.productName}]`}${
                          !g.accountId && g.newAccount ? `   (new account ${g.newAccount.displayName})` : ''
                        }   ${g.adding.length} ad ${g.adding.length === 1 ? 'set' : 'sets'}`,
                    )
                    .join('\n')}
                </Block>
              </>
            )}
            {plan.notes.length > 0 && (
              <>
                <p className={cn(hintClass, 'mt-3')}>Left alone</p>
                <Block className="max-h-48 overflow-auto">{plan.notes.map((n) => `— ${n}`).join('\n')}</Block>
              </>
            )}
          </Section>
        </>
      )}
    </Drawer>
  )
}
