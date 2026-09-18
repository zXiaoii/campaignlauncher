// "Add existing CBO" — bring a campaign that already runs in Meta into the
// workspace without a reset. Charles picks the account, types the campaign name
// exactly as it is in Meta, pastes the ad-set names one per line, and the
// records land next to everything else. Safe on the live database at any time.
//
// Also adds ad sets to a CBO that is already here — the way an "ad sets not imported yet"
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
  isPlaceholderAdset,
  metaExportFromTable,
  parseAdsetLines,
  parseMetaExport,
  PLACEHOLDER_ADSET_NAME,
  readXlsx,
  type MetaExport,
} from '../importing'
import { groupsToImportItems, planExport } from '../importPlan'
import { CAMPAIGN_TYPES, formatLaunchDate, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { accountsInCountry, adAccount, adsetsInCampaign, byId, campaignsInAccount, liveAdsets } from '../selectors'
import { findProductByName, useActions, useStore } from '../store'
import type { CampaignType } from '../types'

type Mode = 'NEW' | 'EXISTING' | 'EXPORT'

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
        .filter((a) => !isPlaceholderAdset(a))
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
    ? liveAdsets(db, existing.id).filter((a) => !isPlaceholderAdset(a)).length
    : 0
  const liveAfter = liveNow + good.length

  const cleanName = name.trim()
  const nameTaken = accountCampaigns.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())

  // ---- Meta export mode ----------------------------------------------------
  const [exportText, setExportText] = useState('')
  const [exportFileName, setExportFileName] = useState<string | null>(null)
  const [skipOff, setSkipOff] = useState(true)
  const [productOverrides, setProductOverrides] = useState<Record<string, string>>({})
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  // Parsed on arrival rather than derived: a .xlsx is read asynchronously.
  const [exportParsed, setExportParsed] = useState<{ parsed: MetaExport | null; error: string | null }>({
    parsed: null,
    error: null,
  })
  const resetExportChoices = () => {
    setProductOverrides({})
    setAccountOverrides({})
    setExcluded([])
  }
  const parseText = (text: string) => {
    resetExportChoices()
    if (!text.trim()) return setExportParsed({ parsed: null, error: null })
    try {
      setExportParsed({ parsed: parseMetaExport(text), error: null })
    } catch (e) {
      setExportParsed({ parsed: null, error: e instanceof Error ? e.message : String(e) })
    }
  }
  const groups = useMemo(
    () =>
      exportParsed.parsed
        ? planExport(db, accountId, exportParsed.parsed, {
            skipOff,
            products: productOverrides,
            accounts: accountOverrides,
            // Read the product out of the campaign name when the book does not know it
            // yet — shown on the card as a suggestion Charles can overwrite.
            deriveProducts: true,
          })
        : [],
    [db, accountId, exportParsed.parsed, skipOff, productOverrides, accountOverrides],
  )
  const selectedGroups = groups.filter((g) => !g.problem && !excluded.includes(g.key))
  const selectedAdsets = selectedGroups.reduce((n, g) => n + g.adding.length, 0)
  const selectedAccountIds = new Set(selectedGroups.map((g) => g.accountId ?? `new:${g.newAccount?.displayName}`))
  const fileHasAccounts = Boolean(exportParsed.parsed?.columns.account)
  const newAccountNames = [...new Set(selectedGroups.filter((g) => g.newAccount).map((g) => g.newAccount!.displayName))]
  const unplacedAccounts = [...new Set(groups.filter((g) => !g.accountId && !g.newAccount?.countryId).map((g) => g.accountName ?? ''))]

  async function readFile(file: File) {
    setExportFileName(file.name)
    setExportText('')
    resetExportChoices()
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const table = await readXlsx(await file.arrayBuffer())
        setExportParsed({ parsed: metaExportFromTable(table), error: null })
      } else if (/\.xls$/i.test(file.name)) {
        setExportParsed({ parsed: null, error: 'Old .xls format — choose .xlsx or CSV in the export dialog.' })
      } else {
        setExportParsed({ parsed: parseMetaExport(await file.text()), error: null })
      }
    } catch (e) {
      setExportParsed({ parsed: null, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const problems: string[] = []
  if (!account && !(mode === 'EXPORT' && fileHasAccounts)) problems.push('Pick an ad account.')
  if (mode === 'EXPORT' && !exportParsed.parsed) problems.push(exportParsed.error ?? 'Choose the exported file or paste the table.')
  if (mode === 'EXPORT' && exportParsed.parsed && selectedGroups.length === 0) problems.push('Nothing selected to add.')
  if (mode === 'NEW' && !cleanName) problems.push('Type the campaign name exactly as it is in Meta.')
  if (mode === 'NEW' && nameTaken) problems.push(`${account?.displayName} already has a CBO named "${cleanName}".`)
  if (mode === 'NEW' && !productName.trim()) problems.push('Type the product.')
  if (mode === 'EXISTING' && !existing) problems.push('Pick the CBO to add ad sets to.')
  if (mode === 'EXISTING' && good.length === 0) problems.push('Paste at least one ad-set name.')
  if (parsed.some((a) => a.problem)) problems.push('Fix the flagged ad-set lines first.')
  // More than four is allowed on import — they already exist in Meta. The CBO
  // simply shows as full, so no new batch can be launched into it.
  const canSave = problems.length === 0

  function submit() {
    if (!canSave) return
    if (mode === 'EXPORT') {
      const items = groupsToImportItems(selectedGroups)
      if (importCampaigns(items)) {
        const created = items.filter((i) => !i.campaignId).length
        const n = selectedAccountIds.size
        const first = [...selectedAccountIds][0] ?? ''
        show({
          tone: 'success',
          kind: 'Imported from Meta',
          title: n === 1 ? (adAccount(db, first)?.displayName ?? first.replace(/^new:/, '')) : `${n} ad accounts`,
          body: `${created} new ${created === 1 ? 'CBO' : 'CBOs'}, ${selectedAdsets} ad ${selectedAdsets === 1 ? 'set' : 'sets'}${
            newAccountNames.length ? `, ${newAccountNames.length} new ad ${newAccountNames.length === 1 ? 'account' : 'accounts'}` : ''
          } added. Nothing else was touched.`,
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
            : 'Added with a placeholder row — paste the real ad-set names when you have them.',
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
              desc: 'Replaces the "ad sets not imported yet" placeholder with the real names.',
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
              label="Exported file (.xlsx or .csv)"
              hint={
                exportFileName ??
                'Ads Manager → Ad sets tab → Reports → Export table data. Include the "Account name" column and one file can cover every ad account in the market.'
              }
            >
              <input
                type="file"
                accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain"
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
                  parseText(e.target.value)
                }}
              />
            </Field>
            {exportParsed.error && <Callout tone="danger">{exportParsed.error}</Callout>}
            {exportParsed.parsed && (
              <>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Chip tone="success">{exportParsed.parsed.rows.length} ad-set rows</Chip>
                  {fileHasAccounts ? (
                    <Chip tone="success">
                      {exportParsed.parsed.accounts.length} ad {exportParsed.parsed.accounts.length === 1 ? 'account' : 'accounts'} ← “
                      {exportParsed.parsed.columns.account}”
                    </Chip>
                  ) : (
                    <Chip tone="warn">no account column — everything goes to {account?.displayName ?? 'the account above'}</Chip>
                  )}
                  <Chip tone="quiet">campaign ← “{exportParsed.parsed.columns.campaign}”</Chip>
                  <Chip tone="quiet">ad set ← “{exportParsed.parsed.columns.adset}”</Chip>
                  {exportParsed.parsed.columns.delivery ? (
                    <Chip tone="quiet">delivery ← “{exportParsed.parsed.columns.delivery}”</Chip>
                  ) : (
                    <Chip tone="warn">no delivery column — every ad set counts as running</Chip>
                  )}
                </div>
                {fileHasAccounts && (
                  <Callout className="mb-3">
                    Each CBO goes to the ad account named on its rows, matched against the Ad Accounts
                    directory by name or by number. The country and account picked above are ignored for
                    this file.
                    {newAccountNames.length > 0 && (
                      <>
                        {' '}
                        <strong>
                          {newAccountNames.length} new ad {newAccountNames.length === 1 ? 'account' : 'accounts'} will be created
                        </strong>{' '}
                        in the market {newAccountNames.length === 1 ? 'its name' : 'their names'} suggest — check the market on
                        those cards, or point them at an existing account instead.
                      </>
                    )}
                    {unplacedAccounts.length > 0 && (
                      <>
                        {' '}
                        <strong>
                          {unplacedAccounts.length} account {unplacedAccounts.length === 1 ? 'name needs' : 'names need'} a market
                        </strong>{' '}
                        — the name does not say which one; pick it on the card.
                      </>
                    )}
                  </Callout>
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
                  const on = !g.problem && !excluded.includes(g.key)
                  const groupAccount = adAccount(db, g.accountId)
                  return (
                    <div
                      key={g.key}
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
                            setExcluded((x) => (e.target.checked ? x.filter((k) => k !== g.key) : [...x, g.key]))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          {fileHasAccounts && (
                            <div className="flex flex-wrap items-center gap-1.5 mb-1 text-xs">
                              {g.accountId && g.accountMatched ? (
                                <span className={cn(mono, 'text-fg-secondary truncate')} title={g.accountName}>
                                  {groupAccount?.displayName}
                                </span>
                              ) : (
                                <>
                                  <span className={cn(mono, 'text-fg-tertiary truncate')} title={g.accountName}>
                                    {g.accountName}
                                  </span>
                                  <span className="text-fg-tertiary">→</span>
                                  <select
                                    className={cn(selectClass, 'h-[28px] w-auto max-w-[340px] text-xs')}
                                    value={g.accountId ?? (g.newAccount?.countryId ? `new:${g.newAccount.countryId}` : '')}
                                    onChange={(e) => setAccountOverrides((a) => ({ ...a, [g.key]: e.target.value }))}
                                  >
                                    <option value="">Pick the market or an existing account…</option>
                                    <optgroup label="Add as a new ad account in">
                                      {db.countries.map((c) => (
                                        <option key={`new:${c.id}`} value={`new:${c.id}`}>
                                          ＋ {c.code}
                                          {g.newAccount?.supplier ? ` · ${g.newAccount.supplier}` : ''}
                                        </option>
                                      ))}
                                    </optgroup>
                                    {db.countries.map((c) => (
                                      <optgroup key={c.id} label={`Existing · ${c.code}`}>
                                        {accountsInCountry(db, c.id).map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.displayName}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(mono, 'font-medium break-all')}>{g.campaignName}</span>
                            {g.existingId ? (
                              <Chip tone="info">already here · +{g.adding.length}</Chip>
                            ) : (
                              <Chip tone="success">new CBO · {g.adding.length}</Chip>
                            )}
                            <Chip
                              tone={g.liveAfter > MAX_ADSETS_PER_CAMPAIGN ? 'warn' : 'quiet'}
                              title={
                                g.liveAfter > MAX_ADSETS_PER_CAMPAIGN
                                  ? 'More than four already in Meta — it will show as full, so no new batch goes into it.'
                                  : undefined
                              }
                            >
                              {g.liveAfter > MAX_ADSETS_PER_CAMPAIGN ? `${g.liveAfter} · over the limit` : `${g.liveAfter}/${MAX_ADSETS_PER_CAMPAIGN}`}
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
                                onChange={(e) => setProductOverrides((p) => ({ ...p, [g.key]: e.target.value }))}
                              />
                              {g.productGuessed && <span className="text-xs text-fg-tertiary">guessed from the name</span>}
                              {g.productDerived && <span className="text-xs text-warn">new product, read from the name — check it</span>}
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
