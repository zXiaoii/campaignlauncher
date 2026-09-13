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
import { parseAdsetLines, PLACEHOLDER_ADSET_NAME } from '../importing'
import { CAMPAIGN_TYPES, formatLaunchDate, MAX_ADSETS_PER_CAMPAIGN } from '../naming'
import { accountsInCountry, adAccount, adsetsInCampaign, byId, campaignsInAccount, liveAdsets } from '../selectors'
import { findProductByName, useActions, useStore } from '../store'
import type { CampaignType } from '../types'

type Mode = 'NEW' | 'EXISTING'

export function ImportDrawer({
  countryId: initialCountryId,
  onClose,
}: {
  countryId: string
  onClose: () => void
}) {
  const { db, error, clearError } = useStore()
  const { importCampaign } = useActions()
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

  const problems: string[] = []
  if (!account) problems.push('Pick an ad account.')
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

  const campaignLabel = mode === 'EXISTING' ? (existing?.name ?? '—') : cleanName || '—'

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
              {good.length > 0
                ? `${good.length} ad ${good.length === 1 ? 'set' : 'sets'} · ${liveAfter}/${MAX_ADSETS_PER_CAMPAIGN} after`
                : mode === 'NEW'
                  ? 'placeholder ad set'
                  : 'no ad sets yet'}
            </div>
          </div>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} title={problems[0]} onClick={submit}>
            {mode === 'EXISTING' ? 'Add ad sets' : 'Add CBO'}
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
          ]}
          onChange={setMode}
        />
      </Section>

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
    </Drawer>
  )
}
