// "Add existing CBO" — bring a campaign that already runs in Meta into the
// workspace without a reset. Charles picks the account, types the campaign name
// exactly as it is in Meta, pastes the ad-set names one per line, and the
// records land next to everything else. Safe on the live database at any time.
//
// Also adds ad sets to a CBO that is already here — the way an "existing ads"
// placeholder gets replaced by the real names when they come in.

import { useMemo, useState } from 'react'

import { useToast } from '../components/Toaster'
import {
  Block,
  Button,
  Callout,
  Chip,
  cn,
  Drawer,
  Field,
  hintClass,
  inputClass,
  mono,
  OptionList,
  Section,
  selectClass,
  textareaClass,
} from '../components/ui'
import { CONCEPT_TYPE_LABEL } from '../labels'
import {
  guessProduct,
  isDeliveryOff,
  parseAdsetLine,
  parseAdsetLines,
  parseMetaExport,
  PLACEHOLDER_ADSET_NAME,
  type MetaExport,
  type ParsedAdset,
} from '../importing'
import { CAMPAIGN_TYPES, formatLaunchDate, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { accountsInCountry, adAccount, adsetsInCampaign, byId, campaignsInAccount, liveAdsets } from '../selectors'
import { findProductByName, useActions, useStore, type CampaignImportInput } from '../store'
import type { CampaignType, Db } from '../types'

type Mode = 'NEW' | 'EXISTING' | 'EXPORT'

// ---------------------------------------------------------------- Meta export

interface ExportAdset extends ParsedAdset {
  /** Why this ad set is left out, when it is. */
  skipped?: string
}

interface ExportGroup {
  campaignName: string
  /** The CBO already in this account with that name, if any. */
  existingId?: string
  adsets: ExportAdset[]
  /** Ad sets that will actually be written. */
  adding: ExportAdset[]
  liveAfter: number
  productName: string
  productGuessed: boolean
  /** Why the whole CBO cannot be added, when it cannot. */
  problem?: string
}

function planExport(
  db: Db,
  accountId: string,
  parsed: MetaExport,
  opts: { skipOff: boolean; accountFilter: string; products: Record<string, string> },
): ExportGroup[] {
  const rows = parsed.rows.filter((r) => !opts.accountFilter || r.account === opts.accountFilter)
  const order: string[] = []
  const byCampaign = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byCampaign.has(r.campaign)) {
      byCampaign.set(r.campaign, [])
      order.push(r.campaign)
    }
    byCampaign.get(r.campaign)!.push(r)
  }
  const accountCampaigns = campaignsInAccount(db, accountId)

  return order.map((campaignName) => {
    const existing = accountCampaigns.find((c) => c.name.toLowerCase() === campaignName.toLowerCase())
    const current = existing
      ? adsetsInCampaign(db, existing.id).filter((a) => !(a.name === PLACEHOLDER_ADSET_NAME && !a.launchedAt))
      : []
    const currentNames = new Set(current.map((a) => a.name))
    const seen = new Set<string>()
    const adsets: ExportAdset[] = []
    for (const r of byCampaign.get(campaignName)!) {
      const p = parseAdsetLine(r.adset)
      if (!p) continue
      const a: ExportAdset = { ...p }
      if (opts.skipOff && isDeliveryOff(r.delivery)) a.skipped = `Meta says ${r.delivery}`
      else if (currentNames.has(a.name)) a.skipped = 'Already here'
      else if (seen.has(a.name)) a.skipped = 'Listed twice'
      seen.add(a.name)
      adsets.push(a)
    }
    const adding = adsets.filter((a) => !a.skipped)
    const liveNow = existing
      ? liveAdsets(db, existing.id).filter((a) => !(a.name === PLACEHOLDER_ADSET_NAME && !a.launchedAt)).length
      : 0
    const liveAfter = liveNow + adding.length
    const override = opts.products[campaignName]
    const guess = existing ? byId(db.products, existing.productId) : guessProduct(campaignName, db.products)
    const productName = override ?? guess?.name ?? ''

    let problem: string | undefined
    if (liveAfter > MAX_ADSETS_PER_CAMPAIGN) {
      problem = `${liveAfter} ad sets — a CBO holds ${MAX_ADSETS_PER_CAMPAIGN}. Turn off the dead ones in Meta or add this CBO by hand.`
    } else if (!existing && adding.length === 0 && adsets.length > 0) {
      problem = 'Every ad set is off in Meta — this CBO looks killed, so it is left out.'
    } else if (!existing && !productName.trim()) {
      problem = 'Type the product.'
    } else if (existing && adding.length === 0) {
      problem = 'Nothing new — every ad set is already here.'
    }

    return {
      campaignName,
      existingId: existing?.id,
      adsets,
      adding,
      liveAfter,
      productName,
      productGuessed: !override && !existing && Boolean(guess),
      problem,
    }
  })
}

export function ImportDrawer({
  countryId: initialCountryId,
  onClose,
}: {
  countryId: string
  onClose: () => void
}) {
  const { db, error, clearError } = useStore()
  const { importCampaign, importCampaigns } = useActions()
  const { show } = useToast()

  const [countryId, setCountryId] = useState(initialCountryId)
  const [accountId, setAccountId] = useState(accountsInCountry(db, initialCountryId)[0]?.id ?? '')
  const account = adAccount(db, accountId)
  const accountCampaigns = accountId ? campaignsInAccount(db, accountId) : []

  const [mode, setMode] = useState<Mode>('NEW')
  const [campaignId, setCampaignId] = useState('')
  const existing = mode === 'EXISTING' ? byId(db.campaigns, campaignId || undefined) : undefined

  const [name, setName] = useState('')
  const [productName, setProductName] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('MAIN')
  const resolvedProduct = findProductByName(db, productName)

  const [lines, setLines] = useState('')
  const existingNames = existing
    ? adsetsInCampaign(db, existing.id)
        .filter((a) => !(a.name === PLACEHOLDER_ADSET_NAME && !a.launchedAt))
        .map((a) => a.name)
    : []
  const existingKey = existingNames.join('\n')
  const parsed = useMemo(
    () => parseAdsetLines(lines, existingKey ? existingKey.split('\n') : []),
    [lines, existingKey],
  )
  const good = parsed.filter((a) => !a.problem)

  // Live ad sets the CBO will hold after this — the four-slot rule applies here too.
  const liveNow = existing
    ? liveAdsets(db, existing.id).filter((a) => !(a.name === PLACEHOLDER_ADSET_NAME && !a.launchedAt)).length
    : 0
  const liveAfter = liveNow + good.length

  const cleanName = name.trim()
  const nameTaken = accountCampaigns.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())

  // ---- Meta export mode ----------------------------------------------------
  const [exportText, setExportText] = useState('')
  const [exportFileName, setExportFileName] = useState<string | null>(null)
  const [skipOff, setSkipOff] = useState(true)
  const [accountFilter, setAccountFilter] = useState('')
  const [productOverrides, setProductOverrides] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  const exportParsed = useMemo<{ parsed: MetaExport | null; error: string | null }>(() => {
    if (!exportText.trim()) return { parsed: null, error: null }
    try {
      return { parsed: parseMetaExport(exportText), error: null }
    } catch (e) {
      return { parsed: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [exportText])
  const groups = useMemo(
    () =>
      exportParsed.parsed
        ? planExport(db, accountId, exportParsed.parsed, { skipOff, accountFilter, products: productOverrides })
        : [],
    [db, accountId, exportParsed.parsed, skipOff, accountFilter, productOverrides],
  )
  const selectedGroups = groups.filter((g) => !g.problem && !excluded.includes(g.campaignName))
  const selectedAdsets = selectedGroups.reduce((n, g) => n + g.adding.length, 0)
  const multiAccount = (exportParsed.parsed?.accounts.length ?? 0) > 1

  function readFile(file: File) {
    setExportFileName(file.name)
    if (/\.xlsx?$/i.test(file.name)) {
      setExportText('')
      setExportFileName(`${file.name} — Excel files cannot be read here; export as CSV instead.`)
      return
    }
    file.text().then(setExportText)
  }

  const problems: string[] = []
  if (!account) problems.push('Pick an ad account.')
  if (mode === 'EXPORT' && !exportParsed.parsed) problems.push(exportParsed.error ?? 'Paste the export or choose the CSV.')
  if (mode === 'EXPORT' && multiAccount && !accountFilter) problems.push('The file spans several ad accounts — pick one.')
  if (mode === 'EXPORT' && exportParsed.parsed && selectedGroups.length === 0) problems.push('Nothing selected to add.')
  if (mode === 'NEW' && !cleanName) problems.push('Type the campaign name exactly as it is in Meta.')
  if (mode === 'NEW' && nameTaken) problems.push(`${account?.displayName} already has a CBO named "${cleanName}".`)
  if (mode === 'NEW' && !productName.trim()) problems.push('Type the product.')
  if (mode === 'EXISTING' && !existing) problems.push('Pick the CBO to add ad sets to.')
  if (mode === 'EXISTING' && good.length === 0) problems.push('Paste at least one ad-set name.')
  if (parsed.some((a) => a.problem)) problems.push('Fix the flagged ad-set lines first.')
  if (liveAfter > MAX_ADSETS_PER_CAMPAIGN) {
    problems.push(`That is ${liveAfter} ad sets — a CBO holds a maximum of ${MAX_ADSETS_PER_CAMPAIGN}.`)
  }
  const canSave = problems.length === 0

  function submit() {
    if (!canSave) return
    if (mode === 'EXPORT') {
      const items: CampaignImportInput[] = selectedGroups.map((g) => ({
        adAccountId: accountId,
        campaignId: g.existingId,
        name: g.existingId ? undefined : g.campaignName,
        productName: g.existingId ? undefined : g.productName,
        campaignType: g.existingId ? undefined : 'MAIN',
        adsets: g.adding.map(({ name, launchedAt, conceptType, conceptLabel }) => ({
          name,
          launchedAt,
          conceptType,
          conceptLabel,
        })),
      }))
      if (importCampaigns(items)) {
        const created = items.filter((i) => !i.campaignId).length
        show({
          tone: 'success',
          kind: 'Imported from Meta',
          title: `${account?.displayName ?? ''}`,
          body: `${created} new ${created === 1 ? 'CBO' : 'CBOs'}, ${selectedAdsets} ad ${selectedAdsets === 1 ? 'set' : 'sets'} added. Nothing else was touched.`,
          ms: 8000,
        })
        onClose()
      }
      return
    }
    const ok = importCampaign({
      adAccountId: accountId,
      campaignId: mode === 'EXISTING' ? campaignId : undefined,
      name: mode === 'NEW' ? cleanName : undefined,
      productName: mode === 'NEW' ? productName : undefined,
      campaignType: mode === 'NEW' ? campaignType : undefined,
      adsets: good.map(({ name, launchedAt, conceptType, conceptLabel }) => ({
        name,
        launchedAt,
        conceptType,
        conceptLabel,
      })),
    })
    if (ok) {
      const where = mode === 'EXISTING' ? existing!.name : cleanName
      show({
        tone: 'success',
        kind: mode === 'EXISTING' ? 'Ad sets added' : 'CBO added',
        title: `${where} · ${account?.displayName ?? ''}`,
        body:
          good.length > 0
            ? `${good.length} ad ${good.length === 1 ? 'set' : 'sets'} now in the workspace. Nothing else was touched.`
            : 'Added with an "existing ads" placeholder — paste the real ad-set names when you have them.',
        ms: 8000,
      })
      onClose()
    }
  }

  const campaignLabel =
    mode === 'EXPORT'
      ? exportParsed.parsed
        ? `${selectedGroups.length} of ${groups.length} ${groups.length === 1 ? 'CBO' : 'CBOs'} in the export`
        : 'Meta export'
      : mode === 'EXISTING'
        ? (existing?.name ?? '—')
        : cleanName || '—'

  return (
    <Drawer
      wide
      title="Add existing CBO"
      subtitle="A campaign that already runs in Meta. Nothing is reset — it lands next to everything else."
      onClose={onClose}
      footer={
        <>
          <div className="min-w-0">
            <div className={cn(mono, 'truncate')} title={campaignLabel}>
              {campaignLabel}
            </div>
            <div className={cn(mono, 'truncate text-fg-tertiary')}>
              {mode === 'EXPORT'
                ? `${selectedAdsets} ad ${selectedAdsets === 1 ? 'set' : 'sets'} to add`
                : good.length > 0
                  ? `${good.length} ad ${good.length === 1 ? 'set' : 'sets'} · ${liveAfter}/${MAX_ADSETS_PER_CAMPAIGN} after`
                  : mode === 'NEW'
                    ? 'placeholder ad set'
                    : 'no ad sets yet'}
            </div>
          </div>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} title={problems[0]} onClick={submit}>
            {mode === 'EXPORT'
              ? `Add ${selectedGroups.length} ${selectedGroups.length === 1 ? 'CBO' : 'CBOs'}`
              : mode === 'EXISTING'
                ? 'Add ad sets'
                : 'Add CBO'}
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

      <Section n={1} title="Where does it run?">
        <div className="grid grid-cols-2 gap-x-3 max-[900px]:grid-cols-1">
          <Field label="Country">
            <select
              className={selectClass}
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value)
                setAccountId(accountsInCountry(db, e.target.value)[0]?.id ?? '')
                setCampaignId('')
              }}
            >
              {db.countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ad account">
            <select
              className={selectClass}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                setCampaignId('')
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
          value={mode}
          options={[
            {
              value: 'NEW' as Mode,
              title: 'A CBO that is not here yet',
              desc: 'Type its Meta name and paste its ad sets.',
            },
            {
              value: 'EXISTING' as Mode,
              title: 'Add ad sets to a CBO already here',
              desc: 'Replaces an "existing ads" placeholder with the real names.',
              disabled: accountCampaigns.length === 0,
              disabledReason: 'No CBOs in this ad account yet.',
            },
            {
              value: 'EXPORT' as Mode,
              title: 'Paste a Meta export',
              desc: 'Ads Manager → Ad sets tab → Export (CSV), or copy the table. Every CBO in the file, at once.',
              note: <Chip tone="accent">fastest</Chip>,
            },
          ]}
          onChange={setMode}
        />
      </Section>

      {mode === 'EXPORT' && (
        <>
          <Section n={2} title="The export">
            <Field
              label="CSV file"
              hint={exportFileName ?? 'In Ads Manager: Ad sets tab → Reports → Export table data → CSV. Excel (.xlsx) will not read here.'}
            >
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                className="block w-full text-[13px] text-fg-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-line-strong file:bg-surface-raised file:text-fg file:text-[13px] file:cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) readFile(f)
                }}
              />
            </Field>
            <Field label="…or paste the table" hint="Select the rows in Ads Manager, copy, paste. The header row must come along.">
              <textarea
                className={cn(textareaClass, 'font-mono min-h-24 text-xs')}
                value={exportText}
                placeholder={'Campaign name\tAd set name\tAd set delivery\nMAIN CBO Revida 4\t09/07/26 SWIPES\tactive'}
                onChange={(e) => {
                  setExportText(e.target.value)
                  setExportFileName(null)
                }}
              />
            </Field>
            {exportParsed.error && <Callout tone="danger">{exportParsed.error}</Callout>}
            {exportParsed.parsed && (
              <>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Chip tone="success">{exportParsed.parsed.rows.length} ad-set rows</Chip>
                  <Chip tone="quiet">campaign ← “{exportParsed.parsed.columns.campaign}”</Chip>
                  <Chip tone="quiet">ad set ← “{exportParsed.parsed.columns.adset}”</Chip>
                  {exportParsed.parsed.columns.delivery ? (
                    <Chip tone="quiet">delivery ← “{exportParsed.parsed.columns.delivery}”</Chip>
                  ) : (
                    <Chip tone="warn">no delivery column — every ad set counts as running</Chip>
                  )}
                </div>
                {multiAccount && (
                  <Field label="Which ad account in the file?" hint="The export spans several accounts. Everything goes into the account picked above.">
                    <select className={selectClass} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                      <option value="">Select…</option>
                      {exportParsed.parsed.accounts.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {exportParsed.parsed.columns.delivery && (
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={skipOff} onChange={(e) => setSkipOff(e.target.checked)} />
                    Skip ad sets Meta reports as off, inactive, completed or deleted
                  </label>
                )}
              </>
            )}
          </Section>

          {groups.length > 0 && (
            <Section
              n={3}
              title="What will be added"
              trailing={
                <Chip tone="accent">
                  {selectedGroups.length}/{groups.length} CBOs · {selectedAdsets} ad sets
                </Chip>
              }
            >
              <div className="grid gap-2">
                {groups.map((g) => {
                  const on = !g.problem && !excluded.includes(g.campaignName)
                  return (
                    <div
                      key={g.campaignName}
                      className={cn(
                        'border rounded-lg px-3 py-2.5',
                        g.problem ? 'border-danger-border bg-danger-bg/40' : on ? 'border-line-strong bg-surface-raised' : 'border-line opacity-60',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          disabled={Boolean(g.problem)}
                          onChange={(e) =>
                            setExcluded((x) =>
                              e.target.checked ? x.filter((n) => n !== g.campaignName) : [...x, g.campaignName],
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(mono, 'font-medium break-all')}>{g.campaignName}</span>
                            {g.existingId ? (
                              <Chip tone="info">already here · +{g.adding.length}</Chip>
                            ) : (
                              <Chip tone="success">new CBO · {g.adding.length}</Chip>
                            )}
                            <Chip tone={g.liveAfter > MAX_ADSETS_PER_CAMPAIGN ? 'danger' : 'quiet'}>
                              {g.liveAfter}/{MAX_ADSETS_PER_CAMPAIGN}
                            </Chip>
                          </div>
                          {!g.existingId && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] uppercase tracking-[0.045em] text-fg-tertiary shrink-0">Product</span>
                              <input
                                className={cn(inputClass, 'h-[30px] max-w-[220px]')}
                                list="import-product-suggestions"
                                value={g.productName}
                                placeholder="Type it"
                                onChange={(e) =>
                                  setProductOverrides((p) => ({ ...p, [g.campaignName]: e.target.value }))
                                }
                              />
                              {g.productGuessed && <span className="text-xs text-fg-tertiary">guessed from the name</span>}
                            </div>
                          )}
                          <div className="mt-2 grid gap-0.5">
                            {g.adsets.map((a) => (
                              <div
                                key={a.name}
                                className={cn('flex items-center gap-2 text-[12.5px]', a.skipped && 'text-fg-tertiary line-through')}
                              >
                                <span className={cn(mono, 'min-w-0 flex-1 truncate')}>{a.name}</span>
                                <span className="text-fg-tertiary whitespace-nowrap no-underline">
                                  {a.skipped ?? (a.launchedAt ? formatLaunchDate(new Date(a.launchedAt)) : 'no date')}
                                </span>
                                {!a.skipped && <Chip tone="quiet">{CONCEPT_TYPE_LABEL[a.conceptType]}</Chip>}
                              </div>
                            ))}
                          </div>
                          {g.problem && <div className="mt-2 text-xs text-danger">{g.problem}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <datalist id="import-product-suggestions">
                {db.products
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
              </datalist>
              {problems.length > 0 && (
                <Callout tone="danger" className="mt-3 mb-0">
                  {problems[0]}
                </Callout>
              )}
            </Section>
          )}
        </>
      )}

      {mode !== 'EXPORT' && (
      <>
      <Section n={2} title={mode === 'EXISTING' ? 'Which CBO?' : 'The CBO, as it is in Meta'}>
        {mode === 'EXISTING' ? (
          <>
            <Field label="CBO">
              <select className={selectClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">Select a CBO…</option>
                {accountCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {liveAdsets(db, c.id).length}/{MAX_ADSETS_PER_CAMPAIGN}
                  </option>
                ))}
              </select>
            </Field>
            {existing && (
              <Block>
                {adsetsInCampaign(db, existing.id)
                  .map((a) => `${a.name}   ${a.status.toLowerCase()}${a.launchedAt ? '' : '   (placeholder)'}`)
                  .join('\n') || 'No ad sets yet.'}
              </Block>
            )}
          </>
        ) : (
          <>
            <Field
              label="Campaign name"
              hint={nameTaken ? 'Already in this account.' : 'Copy it from Meta verbatim — the app never renames imported CBOs.'}
            >
              <input
                className={cn(inputClass, 'font-mono')}
                value={name}
                autoFocus
                placeholder="e.g. MAIN CBO Revida 4"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-x-3 max-[900px]:grid-cols-1">
              <Field
                label="Product"
                hint={
                  !productName.trim()
                    ? 'Existing products suggest as you type.'
                    : resolvedProduct
                      ? 'Existing product.'
                      : 'New product — created with this CBO.'
                }
              >
                <input
                  className={inputClass}
                  list="import-product-suggestions"
                  value={productName}
                  placeholder="e.g. Revida"
                  autoComplete="off"
                  onChange={(e) => setProductName(e.target.value)}
                />
                <datalist id="import-product-suggestions">
                  {db.products
                    .filter((p) => p.active)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                </datalist>
              </Field>
              <Field label="Type" hint="MAIN for anything named by hand in Meta.">
                <select
                  className={selectClass}
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                >
                  <option value="MAIN">MAIN — imported, named in Meta</option>
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.meaning}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}
      </Section>

      <Section
        n={3}
        title="Ad sets"
        trailing={
          good.length > 0 ? <Chip tone="accent">{good.length} parsed</Chip> : <Chip tone="quiet">optional</Chip>
        }
      >
        <Field
          label="One per line, exactly as in Meta"
          hint="The date at the front becomes the launch date; “swipes” / “iterations” set the framework Next batch copies."
        >
          <textarea
            className={cn(textareaClass, 'font-mono min-h-28')}
            value={lines}
            placeholder={'09/07/26 SWIPES\n09/11/26 SWIPES 2'}
            onChange={(e) => setLines(e.target.value)}
          />
        </Field>

        {parsed.length > 0 ? (
          <div className="border border-line rounded-lg overflow-hidden">
            {parsed.map((a, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-[12.5px] border-b border-line last:border-b-0',
                  a.problem && 'bg-danger-bg',
                )}
              >
                <span className={cn(mono, 'min-w-0 flex-1 truncate')}>{a.name}</span>
                <span className="text-fg-tertiary whitespace-nowrap">
                  {a.launchedAt ? `launched ${formatLaunchDate(new Date(a.launchedAt))}` : 'no date'}
                </span>
                <Chip tone={a.problem ? 'danger' : 'quiet'}>{a.problem ?? CONCEPT_TYPE_LABEL[a.conceptType]}</Chip>
              </div>
            ))}
          </div>
        ) : (
          mode === 'NEW' && (
            <div className={hintClass}>
              No ad sets yet? The CBO gets an <span className={mono}>{PLACEHOLDER_ADSET_NAME}</span> placeholder so it
              reads as live; add the real names here later and it disappears.
            </div>
          )
        )}
      </Section>

      <Section title="Review">
        <Block>
          {[
            `ACCOUNT   ${account?.displayName ?? '—'}`,
            `CAMPAIGN  ${campaignLabel}${mode === 'NEW' ? `   ${campaignType}` : ''}`,
            ...(good.length > 0
              ? good.map((a) => `AD SET    ${a.name}`)
              : mode === 'NEW'
                ? [`AD SET    ${PLACEHOLDER_ADSET_NAME}   (placeholder)`]
                : []),
            `SLOTS     ${liveAfter}/${MAX_ADSETS_PER_CAMPAIGN}`,
          ].join('\n')}
        </Block>
        {problems.length > 0 && (
          <Callout tone="danger" className="mt-3 mb-0">
            {problems[0]}
          </Callout>
        )}
      </Section>
      </>
      )}
    </Drawer>
  )
}
