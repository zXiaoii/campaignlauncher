// The one global "+ Launch" action (PRD §6). Charles never has to pick between
// separate New CBO / Clone / Reuse / Relaunch screens — it is always
// source → destination → creative handling → naming → assignment.
//
// Rendered as one scrollable drawer rather than a click-through wizard: §15.1
// budgets 20–30 seconds for a normal launch, and a five-step wizard spends most
// of that on Next buttons. The numbered sections keep the PRD's order intact.

import { useMemo, useState } from 'react'

import { now } from '../clock'
import {
  Block,
  Button,
  Callout,
  Chip,
  cn,
  CopyButton,
  Drawer,
  Field,
  hintClass,
  inputClass,
  mono,
  OptionList,
  Section,
  selectClass,
  textareaClass,
  type OptionItem,
} from '../components/ui'
import {
  CAMPAIGN_TYPE_MEANING,
  CONCEPT_TYPE_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
} from '../labels'
import {
  CAMPAIGN_TYPES,
  CONCEPT_LABELS,
  DEFAULT_DIRECTION,
  MAX_ADSETS_PER_CAMPAIGN,
  toDateInputValue,
} from '../naming'
import {
  accountsInCountry,
  adAccount,
  adset as findAdset,
  adsetsInCampaign,
  byId,
  campaign as findCampaign,
  campaignsInAccount,
  LIBRARY_STATUSES,
  reusableBatches,
  slotsUsed,
} from '../selectors'
import {
  findProductByName,
  previewNames,
  requiresCreative,
  useStore,
  type CreateLaunchInput,
  type SourceKind,
} from '../store'
import type {
  CampaignType,
  ConceptType,
  CreativePriority,
  CreativeReference,
  LaunchMode,
} from '../types'

export interface LaunchIntent {
  sourceKind?: SourceKind
  sourceAdsetId?: string
  sourceBatchId?: string
  adAccountId?: string
  destinationCampaignId?: string
  /** Set when the caller already knows a new CBO is required (source CBO was full). */
  forceNewCampaign?: boolean
  creativeHandling?: LaunchMode
  campaignType?: CampaignType
  conceptType?: ConceptType
}

const SOURCE_OPTIONS: OptionItem<SourceKind>[] = [
  {
    value: 'NEW_BATCH',
    title: 'New Creative Batch',
    desc: 'Fresh Swipes + Playbook, iteration, deep iteration or custom creative.',
    note: <Chip>Yzah gets a task</Chip>,
  },
  {
    value: 'EXISTING_BATCH',
    title: 'Existing Creative Batch',
    desc: 'Use a previously submitted batch again.',
  },
  {
    value: 'EXISTING_ADSET',
    title: 'Existing Ad Set',
    desc: 'Reuse the creative source from a current ad set.',
  },
  {
    value: 'OLD_ADSET',
    title: 'Old / Killed Ad Set',
    desc: 'Bring back a stopped, killed or archived batch.',
  },
  {
    value: 'OWN_DRIVE',
    title: 'My own Drive batch',
    desc: 'You already have the creatives — paste the Drive link. Setup starts Ready.',
    note: <Chip tone="success">No creative task</Chip>,
  },
]

const HANDLING_OPTIONS: { value: LaunchMode; title: string; desc: string }[] = [
  { value: 'REUSE_EXACT', title: 'Reuse exactly', desc: 'Same ads, new ad set. No creative task.' },
  {
    value: 'REUSE_PLUS_NEW',
    title: 'Reuse + add new creatives',
    desc: 'Keep the batch, Yzah adds more on top of it.',
  },
  {
    value: 'NEW_CREATIVE',
    title: 'Create completely new creatives',
    desc: 'Fresh batch from a new brief.',
  },
  {
    value: 'DEEP_ITERATION',
    title: 'Deep iterate source',
    desc: "Source Drive, hooks and direction are attached to Yzah's brief.",
  },
]

const QUANTITIES = [4, 6, 8, 10, 12]

const SWIPES_DEFAULT = DEFAULT_DIRECTION.SWIPES_PLAYBOOK
const DEEP_ITERATION_DEFAULT = DEFAULT_DIRECTION.DEEP_ITERATION

function combine(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).toISOString()
}

/** Small remove button used by the hook and reference lists. */
function RemoveButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" aria-label={label} disabled={disabled} onClick={onClick}>
      ×
    </Button>
  )
}

export function LaunchDrawer({
  intent,
  onClose,
}: {
  intent: LaunchIntent
  onClose: () => void
}) {
  const { db, createLaunch, error, clearError } = useStore()
  const today = now()

  // ---- source -------------------------------------------------------------
  const [sourceKind, setSourceKind] = useState<SourceKind>(
    intent.sourceKind ?? (intent.sourceAdsetId ? 'EXISTING_ADSET' : 'NEW_BATCH'),
  )
  const [sourceAdsetId, setSourceAdsetId] = useState(intent.sourceAdsetId ?? '')
  const [sourceBatchId, setSourceBatchId] = useState(intent.sourceBatchId ?? '')

  const sourceAdset = findAdset(db, sourceAdsetId || undefined)
  const sourceCampaign = sourceAdset ? findCampaign(db, sourceAdset.campaignId) : undefined
  const effectiveSourceBatchId =
    sourceKind === 'EXISTING_BATCH' ? sourceBatchId : sourceAdset?.creativeBatchId
  const sourceBatch = byId(db.creativeBatches, effectiveSourceBatchId || undefined)
  const hasSource = sourceKind !== 'NEW_BATCH' && Boolean(effectiveSourceBatchId)

  // ---- creative handling --------------------------------------------------
  const [handling, setHandling] = useState<LaunchMode>(
    intent.creativeHandling ?? (intent.sourceAdsetId ? 'REUSE_EXACT' : 'NEW_CREATIVE'),
  )
  const effectiveHandling: LaunchMode =
    sourceKind === 'NEW_BATCH' ? 'NEW_CREATIVE' : sourceKind === 'OWN_DRIVE' ? 'OWN_BATCH' : handling
  const creativeNeeded = requiresCreative(effectiveHandling)
  const ownDrive = sourceKind === 'OWN_DRIVE'
  const [ownDriveUrl, setOwnDriveUrl] = useState('')
  const [ownNote, setOwnNote] = useState('')

  // ---- destination --------------------------------------------------------
  const presetCampaign = findCampaign(db, intent.destinationCampaignId)
  const presetAccount = adAccount(
    db,
    intent.adAccountId ?? presetCampaign?.adAccountId ?? sourceCampaign?.adAccountId,
  )
  const [countryId, setCountryId] = useState(presetAccount?.countryId ?? db.countries[0].id)
  const [accountId, setAccountId] = useState(
    presetAccount?.id ?? accountsInCountry(db, db.countries[0].id)[0]?.id ?? '',
  )
  const [destKind, setDestKind] = useState<'EXISTING_CAMPAIGN' | 'NEW_CAMPAIGN'>(
    intent.forceNewCampaign ? 'NEW_CAMPAIGN' : presetCampaign ? 'EXISTING_CAMPAIGN' : 'NEW_CAMPAIGN',
  )
  const [campaignId, setCampaignId] = useState(presetCampaign?.id ?? '')

  const accountCampaigns = accountId ? campaignsInAccount(db, accountId) : []
  const destCampaign = findCampaign(db, campaignId)

  // Product is free text: prefilled from the source/destination campaign when there
  // is one, otherwise empty. An existing product matches by name; anything else is
  // created with the CBO.
  const presetProduct = byId(db.products, presetCampaign?.productId ?? sourceCampaign?.productId)
  const [productName, setProductName] = useState(presetProduct?.name ?? '')
  const resolvedProduct = findProductByName(db, productName)
  const productId = resolvedProduct?.id

  // Suggested campaign type (§4.1 — NEW when the product has no campaign here yet).
  const suggestedType: CampaignType = useMemo(() => {
    if (effectiveHandling === 'DEEP_ITERATION') return 'DIT'
    if (sourceAdset && LIBRARY_STATUSES.includes(sourceAdset.status)) return 'REL'
    if (hasSource && effectiveHandling === 'REUSE_EXACT') return 'REL'
    const existing = productId ? accountCampaigns.filter((c) => c.productId === productId) : []
    return existing.length === 0 ? 'NEW' : 'SWE'
  }, [effectiveHandling, sourceAdset, hasSource, accountCampaigns, productId])

  const [campaignTypeOverride, setCampaignTypeOverride] = useState<CampaignType | ''>(
    intent.campaignType ?? '',
  )
  const campaignType = campaignTypeOverride || suggestedType

  // ---- concept + date -----------------------------------------------------
  const [conceptType, setConceptType] = useState<ConceptType>(
    intent.conceptType ??
      (intent.creativeHandling === 'DEEP_ITERATION' ? 'DEEP_ITERATION' : 'SWIPES_PLAYBOOK'),
  )
  const inheritedLabel = effectiveHandling === 'REUSE_EXACT' ? sourceAdset?.conceptLabel : undefined
  const autoLabel =
    effectiveHandling === 'DEEP_ITERATION'
      ? CONCEPT_LABELS.DEEP_ITERATION
      : (inheritedLabel ?? CONCEPT_LABELS[conceptType] ?? '')
  const [labelOverride, setLabelOverride] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const conceptLabel = labelOverride || autoLabel

  const [launchDate, setLaunchDate] = useState(toDateInputValue(today))

  // ---- brief --------------------------------------------------------------
  const [hooks, setHooks] = useState<string[]>([''])
  const [pasteMany, setPasteMany] = useState(false)
  const [pasteBuffer, setPasteBuffer] = useState('')
  const [angle, setAngle] = useState('')
  const [direction, setDirection] = useState(
    effectiveHandling === 'DEEP_ITERATION' ? DEEP_ITERATION_DEFAULT : SWIPES_DEFAULT,
  )
  const [references, setReferences] = useState<CreativeReference[]>([])
  const [quantity, setQuantity] = useState(8)
  const [priority, setPriority] = useState<CreativePriority>('NORMAL')

  // ---- deadlines ----------------------------------------------------------
  // No setup assignee: the task goes to Karl and Christian's shared queue.
  const [setupDue, setSetupDue] = useState(toDateInputValue(today))
  const [setupTime, setSetupTime] = useState('18:00')
  const [creativeDue, setCreativeDue] = useState(toDateInputValue(today))
  const [creativeTime, setCreativeTime] = useState('12:00')

  // ---- assembled input + preview -----------------------------------------
  const input: CreateLaunchInput = {
    sourceKind,
    sourceAdsetId: sourceKind === 'NEW_BATCH' ? undefined : sourceAdsetId || undefined,
    sourceBatchId: sourceKind === 'EXISTING_BATCH' ? sourceBatchId || undefined : undefined,
    creativeHandling: effectiveHandling,
    adAccountId: accountId,
    destination:
      destKind === 'EXISTING_CAMPAIGN'
        ? { kind: 'EXISTING_CAMPAIGN', campaignId }
        : { kind: 'NEW_CAMPAIGN', campaignType, productName },
    conceptType: effectiveHandling === 'DEEP_ITERATION' ? 'DEEP_ITERATION' : conceptType,
    conceptLabel,
    launchDate,
    brief: {
      hooks: hooks.map((h) => h.trim()).filter(Boolean),
      angle,
      direction: ownDrive ? ownNote : direction,
      references: references.filter((r) => r.url.trim()),
      quantity,
      priority,
    },
    ownDriveUrl: ownDrive ? ownDriveUrl : undefined,
    setupDueAt: combine(setupDue, setupTime),
    creativeDueAt: combine(creativeDue, creativeTime),
  }

  const preview = previewNames(db, input)

  const sourceMissing = sourceKind !== 'NEW_BATCH' && !ownDrive && !effectiveSourceBatchId
  const problems: string[] = []
  if (sourceMissing) problems.push('Select the source to launch from.')
  if (ownDrive && !ownDriveUrl.trim()) problems.push('Paste the Drive link for your batch.')
  if (!conceptLabel.trim()) problems.push('The ad set needs a concept label.')
  if (preview.blocked) problems.push(preview.blocked)
  const canCreate = problems.length === 0

  const liveAdsetChoices = db.adsets
    .filter((a) => !LIBRARY_STATUSES.includes(a.status) && a.creativeBatchId)
    .map((a) => ({ adset: a, campaign: findCampaign(db, a.campaignId)! }))
    .filter((x) => Boolean(x.campaign))
  const oldAdsetChoices = db.adsets
    .filter((a) => LIBRARY_STATUSES.includes(a.status) && a.creativeBatchId)
    .map((a) => ({ adset: a, campaign: findCampaign(db, a.campaignId)! }))
    .filter((x) => Boolean(x.campaign))

  function submit() {
    if (!canCreate) return
    if (createLaunch(input)) onClose()
  }

  const copyBlock = [
    `Ad Account: ${preview.accountDisplayName}`,
    `Campaign: ${preview.campaignName}`,
    `Ad Set: ${preview.adsetName}`,
  ].join('\n')

  const launchDateField = (
    <Field label="Launch date" hint="The destination ad-set name starts with this.">
      <input
        className={inputClass}
        type="date"
        value={launchDate}
        onChange={(e) => setLaunchDate(e.target.value)}
      />
    </Field>
  )

  return (
    <Drawer
      wide
      title="New launch"
      subtitle="Source → destination → creative handling → assignment"
      onClose={onClose}
      footer={
        <>
          <div className="min-w-0">
            <div className={cn(mono, 'truncate')} title={preview.campaignName}>
              {preview.campaignName}
            </div>
            <div className={cn(mono, 'truncate text-fg-tertiary')} title={preview.adsetName}>
              {preview.adsetName}
            </div>
          </div>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canCreate} title={problems[0]} onClick={submit}>
            Create launch
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger">
          <strong>Blocked.</strong> {error}{' '}
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </Callout>
      )}

      {/* ---------------------------------------------------------- step 1 */}
      <Section n={1} title="What are you launching from?">
        <OptionList
          value={sourceKind}
          options={SOURCE_OPTIONS}
          onChange={(v) => {
            setSourceKind(v)
            if (v === 'NEW_BATCH') {
              setSourceAdsetId('')
              setSourceBatchId('')
            }
            if (v !== 'NEW_BATCH' && handling === 'NEW_CREATIVE') setHandling('REUSE_EXACT')
          }}
        />

        {sourceKind === 'EXISTING_BATCH' && (
          <div className="mt-3">
            <Field label="Creative batch">
              <select
                className={selectClass}
                value={sourceBatchId}
                onChange={(e) => setSourceBatchId(e.target.value)}
              >
                <option value="">Select a submitted batch…</option>
                {reusableBatches(db).map((b) => {
                  const prod = byId(db.products, b.productId)
                  return (
                    <option key={b.id} value={b.id}>
                      {prod?.name} · {CONCEPT_TYPE_LABEL[b.type]} ·{' '}
                      {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </option>
                  )
                })}
              </select>
            </Field>
          </div>
        )}

        {(sourceKind === 'EXISTING_ADSET' || sourceKind === 'OLD_ADSET') && (
          <div className="mt-3">
            <Field label={sourceKind === 'OLD_ADSET' ? 'Old / killed ad set' : 'Ad set'}>
              <select
                className={selectClass}
                value={sourceAdsetId}
                onChange={(e) => setSourceAdsetId(e.target.value)}
              >
                <option value="">Select an ad set…</option>
                {(sourceKind === 'OLD_ADSET' ? oldAdsetChoices : liveAdsetChoices).map(
                  ({ adset, campaign }) => (
                    <option key={adset.id} value={adset.id}>
                      {campaign.name} → {adset.name}
                      {sourceKind === 'OLD_ADSET' ? ` (${adset.status.toLowerCase()})` : ''}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        )}

        {sourceBatch && (
          <Block>
            {[
              `SOURCE BATCH   ${byId(db.products, sourceBatch.productId)?.name} / ${CONCEPT_TYPE_LABEL[sourceBatch.type]}`,
              sourceAdset && sourceCampaign
                ? `SOURCE AD SET  ${sourceCampaign.name} → ${sourceAdset.name}`
                : null,
              `DRIVE          ${sourceBatch.driveUrl ?? 'not submitted yet'}`,
              sourceBatch.hooks.length ? `HOOKS          ${sourceBatch.hooks.length} stored` : null,
            ]
              .filter(Boolean)
              .join('\n')}
          </Block>
        )}
      </Section>

      {/* ---------------------------------------------------------- step 2 */}
      <Section n={2} title="Where are you launching it?">
        <div className="grid grid-cols-2 gap-x-3 max-[900px]:grid-cols-1">
          <Field label="Country">
            <select
              className={selectClass}
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value)
                const first = accountsInCountry(db, e.target.value)[0]
                setAccountId(first?.id ?? '')
                setCampaignId('')
                setDestKind('NEW_CAMPAIGN')
              }}
            >
              {db.countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Ad account"
            hint={
              accountId
                ? `Campaign naming uses ${adAccount(db, accountId)?.adAccountNumber || '—'}`
                : undefined
            }
          >
            <select
              className={selectClass}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                setCampaignId('')
                setDestKind('NEW_CAMPAIGN')
              }}
            >
              {accountsInCountry(db, countryId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <OptionList
          value={destKind}
          options={[
            {
              value: 'EXISTING_CAMPAIGN' as const,
              title: 'Existing CBO',
              desc: 'Add this ad set to a campaign that already exists.',
              disabled: accountCampaigns.length === 0,
              disabledReason: 'No campaigns in this ad account yet.',
            },
            {
              value: 'NEW_CAMPAIGN' as const,
              title: 'New CBO',
              desc: 'Generate a new campaign name for this account.',
            },
          ]}
          onChange={setDestKind}
        />

        {destKind === 'EXISTING_CAMPAIGN' && (
          <div className="mt-3">
            <Field label="Destination CBO">
              <select
                className={selectClass}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">Select a CBO…</option>
                {accountCampaigns.map((c) => {
                  const used = slotsUsed(db, c.id)
                  const full = used >= MAX_ADSETS_PER_CAMPAIGN
                  return (
                    <option key={c.id} value={c.id} disabled={full}>
                      {c.name} — {used}/{MAX_ADSETS_PER_CAMPAIGN}
                      {full ? ' (full)' : ''}
                    </option>
                  )
                })}
              </select>
            </Field>
            {destCampaign && slotsUsed(db, destCampaign.id) >= MAX_ADSETS_PER_CAMPAIGN && (
              <Callout tone="danger">
                <strong>{destCampaign.name} is full.</strong> A CBO holds a maximum of{' '}
                {MAX_ADSETS_PER_CAMPAIGN} ad sets.{' '}
                <Button
                  size="sm"
                  onClick={() => {
                    setDestKind('NEW_CAMPAIGN')
                    setProductName(byId(db.products, destCampaign.productId)?.name ?? '')
                    setCampaignId('')
                  }}
                >
                  Create new CBO with this source
                </Button>
              </Callout>
            )}
            {destCampaign && (
              <Block>
                {adsetsInCampaign(db, destCampaign.id)
                  .map((a) => `${a.name}   ${a.status.toLowerCase()}`)
                  .join('\n') || 'No ad sets yet.'}
              </Block>
            )}
          </div>
        )}

        {destKind === 'NEW_CAMPAIGN' && (
          <div className="grid grid-cols-2 gap-x-3 mt-3 max-[900px]:grid-cols-1">
            <Field
              label="Product"
              hint={
                !productName.trim()
                  ? 'Type it — existing products suggest as you type.'
                  : resolvedProduct
                    ? `Existing product · ${accountCampaigns.filter((c) => c.productId === resolvedProduct.id).length} CBO(s) in this account`
                    : 'New product — it will be created with this CBO.'
              }
            >
              <input
                className={inputClass}
                list="product-suggestions"
                value={productName}
                placeholder="e.g. Revida"
                autoComplete="off"
                onChange={(e) => setProductName(e.target.value)}
              />
              <datalist id="product-suggestions">
                {db.products
                  .filter((p) => p.active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
              </datalist>
            </Field>
            <Field
              label="Campaign type"
              hint={`Suggested: ${suggestedType} — ${CAMPAIGN_TYPE_MEANING[suggestedType]}`}
            >
              <select
                className={selectClass}
                value={campaignTypeOverride || suggestedType}
                onChange={(e) => setCampaignTypeOverride(e.target.value as CampaignType)}
              >
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.meaning}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------------- step 3 */}
      <Section n={3} title="Creative handling">
        {ownDrive ? (
          <>
            <Callout>
              Your creatives, your link. <strong>No creative task</strong> — setup starts at{' '}
              <em>Ready</em> with this Drive folder on the copy block.
            </Callout>
            <Field label="Google Drive link">
              <input
                className={inputClass}
                value={ownDriveUrl}
                autoFocus
                placeholder="https://drive.google.com/drive/folders/…"
                onChange={(e) => setOwnDriveUrl(e.target.value)}
              />
            </Field>
            <Field label="Note for setup (optional)">
              <textarea
                className={textareaClass}
                value={ownNote}
                placeholder="e.g. 6 videos, use the 1:1 versions for Reels"
                onChange={(e) => setOwnNote(e.target.value)}
              />
            </Field>
          </>
        ) : sourceKind === 'NEW_BATCH' ? (
          <Callout>
            A new creative batch always means new work — <strong>Yzah gets a task</strong> and
            setup starts at <em>Waiting for Creative</em>.
          </Callout>
        ) : (
          <OptionList
            value={handling}
            options={HANDLING_OPTIONS.map((o) => ({
              value: o.value,
              title: o.title,
              desc: o.desc,
              note: requiresCreative(o.value) ? <Chip>Yzah gets a task</Chip> : undefined,
              disabled: sourceMissing,
              disabledReason: 'Pick a source first.',
            }))}
            onChange={setHandling}
          />
        )}

        {effectiveHandling !== 'DEEP_ITERATION' ? (
          <div className="grid grid-cols-2 gap-x-3 mt-3 max-[900px]:grid-cols-1">
            <Field label="Creative framework">
              <select
                className={selectClass}
                value={conceptType}
                disabled={effectiveHandling === 'REUSE_EXACT'}
                onChange={(e) => {
                  const next = e.target.value as ConceptType
                  setConceptType(next)
                  setLabelOverride('')
                  if (next === 'SWIPES_PLAYBOOK') setDirection(SWIPES_DEFAULT)
                }}
              >
                {(['SWIPES_PLAYBOOK', 'ITERATION', 'DEEP_ITERATION', 'CUSTOM'] as ConceptType[]).map((t) => (
                  <option key={t} value={t}>
                    {CONCEPT_TYPE_LABEL[t]}
                    {t === 'SWIPES_PLAYBOOK' ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            {launchDateField}
          </div>
        ) : (
          <div className="mt-3">{launchDateField}</div>
        )}

        {effectiveHandling === 'REUSE_EXACT' && sourceAdset && (
          <Callout>
            Reusing <span className={mono}>{sourceAdset.name}</span> exactly.{' '}
            <strong>Yzah receives nothing</strong>, and setup is ready immediately. The source
            date stays source history — the destination gets today&apos;s date.
          </Callout>
        )}
      </Section>

      {/* ---------------------------------------------------------- step 4 */}
      {creativeNeeded && (
        <Section n={4} title="Creative brief" trailing={<Chip>{CONCEPT_TYPE_LABEL[input.conceptType]}</Chip>}>
          <Field label="Hooks" hint="One hook per input. Paste multiple splits on new lines.">
            <div className="grid gap-1.5">
              {hooks.map((h, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    className={inputClass}
                    value={h}
                    placeholder={`Hook ${i + 1}`}
                    onChange={(e) => setHooks(hooks.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <RemoveButton
                    label={`Remove hook ${i + 1}`}
                    disabled={hooks.length === 1}
                    onClick={() => setHooks(hooks.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => setHooks([...hooks, ''])}>
                  + Hook
                </Button>
                <Button size="sm" onClick={() => setPasteMany((p) => !p)}>
                  {pasteMany ? 'Hide paste box' : 'Paste multiple'}
                </Button>
              </div>
              {pasteMany && (
                <div className="grid gap-1.5">
                  <textarea
                    className={textareaClass}
                    placeholder="One hook per line…"
                    value={pasteBuffer}
                    onChange={(e) => setPasteBuffer(e.target.value)}
                  />
                  <div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const lines = pasteBuffer.split('\n').map((l) => l.trim()).filter(Boolean)
                        if (!lines.length) return
                        setHooks([...hooks.filter((h) => h.trim()), ...lines])
                        setPasteBuffer('')
                        setPasteMany(false)
                      }}
                    >
                      Add {pasteBuffer.split('\n').filter((l) => l.trim()).length} hooks
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-x-3 max-[900px]:grid-cols-1">
            <Field label="Angle">
              <input
                className={inputClass}
                value={angle}
                placeholder="Optional short text"
                onChange={(e) => setAngle(e.target.value)}
              />
            </Field>
            <Field label="Quantity">
              <select className={selectClass} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {QUANTITIES.map((q) => (
                  <option key={q} value={q}>
                    {q} creatives
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority" hint="Sorts Yzah's queue before due date.">
              <select
                className={selectClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value as CreativePriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Direction">
            <textarea className={textareaClass} value={direction} onChange={(e) => setDirection(e.target.value)} />
          </Field>

          <Field label="References" hint="Meta Ad Library, Drive folders, web pages.">
            <div className="grid gap-1.5">
              {references.map((r, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    className={inputClass}
                    value={r.url}
                    placeholder="https://…"
                    onChange={(e) =>
                      setReferences(references.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                    }
                  />
                  <input
                    className={cn(inputClass, 'max-w-40')}
                    value={r.label ?? ''}
                    placeholder="Label (optional)"
                    onChange={(e) =>
                      setReferences(references.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <RemoveButton
                    label={`Remove reference ${i + 1}`}
                    onClick={() => setReferences(references.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <div>
                <Button size="sm" onClick={() => setReferences([...references, { url: '' }])}>
                  + Reference
                </Button>
              </div>
            </div>
          </Field>

          {sourceBatch?.driveUrl && effectiveHandling !== 'NEW_CREATIVE' && (
            <Callout>
              The source Drive link and original direction are attached to Yzah&apos;s brief
              automatically.
            </Callout>
          )}
        </Section>
      )}

      {/* ---------------------------------------------------------- step 5 */}
      <Section n={creativeNeeded ? 5 : 4} title="Deadlines">
        <div className="grid grid-cols-2 gap-x-3 max-[900px]:grid-cols-1">
        {creativeNeeded && (
          <Field label="Creative deadline" hint="Yzah's queue.">
            <div className="flex gap-1.5">
              <input className={inputClass} type="date" value={creativeDue} onChange={(e) => setCreativeDue(e.target.value)} />
              <input
                className={cn(inputClass, 'max-w-[120px]')}
                type="time"
                value={creativeTime}
                onChange={(e) => setCreativeTime(e.target.value)}
              />
            </div>
          </Field>
        )}

        <Field label="Setup deadline" hint="Karl and Christian's shared queue.">
          <div className="flex gap-1.5">
            <input className={inputClass} type="date" value={setupDue} onChange={(e) => setSetupDue(e.target.value)} />
            <input
              className={cn(inputClass, 'max-w-[120px]')}
              type="time"
              value={setupTime}
              onChange={(e) => setSetupTime(e.target.value)}
            />
          </div>
        </Field>
        </div>
      </Section>

      {/* -------------------------------------------------- naming preview */}
      <Section title="Review the exact names">
        <div className="px-[13px] py-3 border border-line-strong rounded-lg bg-surface-raised shadow-highlight">
          <dl className="grid grid-cols-[92px_1fr] gap-x-2.5 gap-y-1.5 m-0">
            <dt className="pt-px text-[11px] tracking-[0.045em] uppercase text-fg-tertiary">Account</dt>
            <dd className="m-0 font-mono text-[12.5px] break-all">{preview.accountDisplayName}</dd>
            <dt className="pt-px text-[11px] tracking-[0.045em] uppercase text-fg-tertiary">Campaign</dt>
            <dd className="m-0 font-mono text-[12.5px] break-all">
              {preview.campaignName} {preview.isNewCampaign && <Chip tone="quiet">new CBO</Chip>}
            </dd>
            <dt className="pt-px text-[11px] tracking-[0.045em] uppercase text-fg-tertiary">Ad set</dt>
            <dd className="m-0 font-mono text-[12.5px] break-all">{preview.adsetName}</dd>
            <dt className="pt-px text-[11px] tracking-[0.045em] uppercase text-fg-tertiary">Slots</dt>
            <dd className="m-0 font-mono text-[12.5px]">
              {preview.slotsAfter}/{MAX_ADSETS_PER_CAMPAIGN} after this launch
            </dd>
          </dl>
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <Button
              size="sm"
              onClick={() => {
                setEditingLabel((v) => !v)
                if (!labelOverride) setLabelOverride(autoLabel)
              }}
            >
              {editingLabel ? 'Done' : 'Edit label'}
            </Button>
            <CopyButton value={copyBlock} label="Copy all three" />
            {labelOverride && labelOverride !== autoLabel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLabelOverride('')
                  setEditingLabel(false)
                }}
              >
                Reset label
              </Button>
            )}
          </div>
          {editingLabel && (
            <div className="mt-2">
              <input
                className={inputClass}
                value={labelOverride}
                placeholder="swipes + playbook"
                onChange={(e) => setLabelOverride(e.target.value)}
              />
              <div className={hintClass}>
                The date is always generated. Only the concept label is editable.
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 text-fg-secondary [&_strong]:text-fg [&_strong]:font-medium">
          {creativeNeeded ? (
            <>
              Creates <strong>1 creative task</strong> for Yzah ({PRIORITY_LABEL[priority].toLowerCase()}{' '}
              priority) and <strong>1 setup task</strong> starting at <em>Waiting for Creative</em>.
            </>
          ) : (
            <>
              Creates <strong>1 setup task</strong> only, starting at <em>Ready for Setup</em>
              {ownDrive ? ' with your Drive link' : ''}. No creative task.
            </>
          )}
        </div>

        {preview.warning && (
          <Callout className="mt-3 mb-0 border-l-warn">
            <strong>⚠ Account problem.</strong> {preview.warning} You can still create the launch.
          </Callout>
        )}

        {problems.length > 0 && (
          <Callout tone="danger" className="mt-3 mb-0">
            {problems[0]}
          </Callout>
        )}
      </Section>
    </Drawer>
  )
}
