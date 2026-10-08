// "New products to launch" — the container between Charles and the setup team.
//
// Charles queues a product for a market with its instructions and where the
// creatives come from; he does not pick the ad account. Whoever on the setup team
// takes it picks the account and presses Place: the CBO, the ad set, the launch and
// the tasks are created right there, as if Charles had launched into that account.
// Mark and Danny see the container read-only.

import { useState } from 'react'

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
import { CONCEPT_TYPE_LABEL, PRIORITIES, PRIORITY_LABEL, PriorityChip } from '../labels'
import { formatLaunchDate, formatTime } from '../naming'
import { canWrite } from '../permissions'
import { accountsInCountry, userName } from '../selectors'
import { useActions, useStore, type ProductLaunchInput } from '../store'
import type { ConceptType, CreativePriority, CreativeReference, ProductLaunch } from '../types'

type CreativeKind = ProductLaunch['creative']['kind']

/** One reference per line: the link, then (optionally) what it is. */
function parseReferences(text: string): CreativeReference[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [url, ...rest] = l.split(/\s+/)
      return { url, label: rest.join(' ').replace(/^[-–—:|]\s*/, '').trim() || undefined }
    })
}

export function ProductQueue({ countryId, compact }: { countryId?: string; compact?: boolean }) {
  const { db, currentUser } = useStore()
  const canAdd = canWrite(currentUser.role, 'createLaunch')
  const canPlace = canWrite(currentUser.role, 'productQueue')
  const [adding, setAdding] = useState(false)
  const [showPlaced, setShowPlaced] = useState(false)

  const inScope = db.productLaunches.filter((p) => !countryId || p.countryId === countryId)
  const open = inScope.filter((p) => p.status === 'OPEN').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const weekAgo = Date.now() - 7 * 86_400_000
  const placed = inScope
    .filter((p) => p.status === 'PLACED' && new Date(p.placedAt ?? 0).getTime() > weekAgo)
    .sort((a, b) => ((a.placedAt ?? '') < (b.placedAt ?? '') ? 1 : -1))

  if (open.length === 0 && placed.length === 0 && !canAdd) return null

  return (
    <section className="mb-4 border border-l-2 border-line border-l-accent rounded-r-xl bg-surface-raised shadow-highlight">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 border-b border-line">
        <strong className="text-[13px]">New products to launch</strong>
        <Chip tone={open.length ? 'accent' : 'quiet'}>{open.length} waiting</Chip>
        <span className="text-xs text-fg-secondary">
          {canPlace && currentUser.role !== 'MEDIA_BUYER'
            ? 'Pick the ad account for each one and press Place — the CBO and your setup task are created on the spot.'
            : 'Setup picks the ad account; the CBO and the tasks are created when they place it.'}
        </span>
        <span className="flex-1" />
        {placed.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowPlaced((v) => !v)}>
            {showPlaced ? 'Hide placed' : `Placed this week (${placed.length})`}
          </Button>
        )}
        {canAdd && (
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            ＋ New product
          </Button>
        )}
      </div>

      {open.length === 0 && !showPlaced && (
        <p className="m-0 px-3.5 py-3 text-fg-secondary">
          Nothing waiting{countryId ? ' in this market' : ''}.{canAdd ? ' Add a product and setup will place it.' : ''}
        </p>
      )}

      {open.length > 0 && (
        <div className={cn('grid gap-2 p-2.5', compact ? 'grid-cols-2 max-[900px]:grid-cols-1' : 'grid-cols-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1')}>
          {open.map((p) => (
            <QueuedCard key={p.id} item={p} canPlace={canPlace} canRemove={canAdd} />
          ))}
        </div>
      )}

      {showPlaced && placed.length > 0 && (
        <Block className="m-2.5 max-h-56 overflow-auto">
          {[
            `PLACED THIS WEEK (${placed.length})`,
            ...placed.map((p) => {
              const acc = db.adAccounts.find((a) => a.id === p.adAccountId)
              const cm = db.campaigns.find((c) => c.id === p.campaignId)
              return `  ${p.productName}   → ${cm?.name ?? '—'}   · ${acc?.displayName ?? '—'}   · ${userName(db, p.placedBy ?? '')} ${
                p.placedAt ? `${formatLaunchDate(new Date(p.placedAt))} ${formatTime(p.placedAt)}` : ''
              }`
            }),
          ].join('\n')}
        </Block>
      )}

      {adding && <NewProductDrawer defaultCountryId={countryId} onClose={() => setAdding(false)} />}
    </section>
  )
}

function QueuedCard({ item: p, canPlace, canRemove }: { item: ProductLaunch; canPlace: boolean; canRemove: boolean }) {
  const { db, currentUser } = useStore()
  const { placeProduct, removeQueuedProduct } = useActions()
  const { show } = useToast()
  const country = db.countries.find((c) => c.id === p.countryId)
  // Accounts setup can place into: in the market, in play, not on hold.
  const accounts = accountsInCountry(db, p.countryId).filter((a) => !a.onHold && a.status === 'ACTIVE')
  const [accountId, setAccountId] = useState('')
  const picked = db.adAccounts.find((a) => a.id === accountId)
  const own = p.creative.kind === 'OWN_DRIVE'

  return (
    <article className="flex flex-col border border-line rounded-lg bg-surface">
      <div className="flex flex-wrap items-baseline gap-2 px-3 py-2 border-b border-line">
        <span className={cn(mono, 'font-medium text-[13px]')}>{p.productName}</span>
        <Chip tone="info">{country?.code ?? '—'}</Chip>
        <Chip tone="accent">{CONCEPT_TYPE_LABEL[p.conceptType]}</Chip>
        <PriorityChip priority={p.priority} />
        <span className="ml-auto text-[11px] text-fg-tertiary whitespace-nowrap">
          {userName(db, p.createdBy)} · {formatLaunchDate(new Date(p.createdAt))}
        </span>
      </div>
      <div className="px-3 py-2 text-[13px] grid gap-1.5">
        <div className="text-fg-secondary">
          {own ? (
            <>
              Creatives ready:{' '}
              <a
                href={(p.creative as { driveUrl: string }).driveUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent border-b border-accent-border hover:border-accent"
              >
                Drive folder
              </a>{' '}
              — setup task starts Ready.
            </>
          ) : (
            <>
              Yzah already has the task — {(p.creative as { quantity: number }).quantity} creatives. Place it any time; setup starts Ready once she submits.
              {p.creative.kind === 'NEW' && p.creative.angle ? ` Angle: ${p.creative.angle}.` : ''}
            </>
          )}
        </div>
        {p.instructions && <Block className="whitespace-pre-wrap">{p.instructions}</Block>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-line bg-bg-subtle mt-auto">
        {canPlace ? (
          <>
            <select className={cn(selectClass, 'h-8 flex-1 min-w-[160px]')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Pick the ad account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                  {a.supplierRef ? ` — ${a.supplierRef}` : ''}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              disabled={!accountId}
              title={picked ? `Creates NEW ${p.productName} ${picked.adAccountNumber} in ${picked.displayName}` : 'Pick the ad account first.'}
              onClick={() => {
                if (placeProduct(p.id, accountId)) {
                  show({
                    tone: 'success',
                    kind: 'Placed',
                    title: `${p.productName} → ${picked?.displayName ?? ''}`,
                    body: own
                      ? 'CBO and ad set created; your setup task is Ready now.'
                      : 'CBO and ad set created; your setup task is Ready as soon as Yzah has submitted the creatives.',
                    ms: 9000,
                  })
                }
              }}
            >
              Place here
            </Button>
            {accounts.length === 0 && <span className="text-xs text-danger">No account in play in {country?.code} — add or resume one first.</span>}
          </>
        ) : (
          <span className="text-xs text-fg-secondary">Waiting for setup to pick an account.</span>
        )}
        {canRemove && currentUser.role === 'MEDIA_BUYER' && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => removeQueuedProduct(p.id)}>
            Remove
          </Button>
        )}
      </div>
    </article>
  )
}

function NewProductDrawer({ defaultCountryId, onClose }: { defaultCountryId?: string; onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { queueProduct } = useActions()
  const { show } = useToast()
  const [productName, setProductName] = useState('')
  const [countryIds, setCountryIds] = useState<string[]>(defaultCountryId ? [defaultCountryId] : [])
  const [instructions, setInstructions] = useState('')
  const [kind, setKind] = useState<CreativeKind>('NEW')
  const [driveUrl, setDriveUrl] = useState('')
  const [quantity, setQuantity] = useState(8)
  const [angle, setAngle] = useState('')
  const [direction, setDirection] = useState('')
  const [refs, setRefs] = useState('')
  const [conceptType, setConceptType] = useState<ConceptType>('SWIPES')
  const [priority, setPriority] = useState<CreativePriority>('NORMAL')

  const ready = productName.trim() && countryIds.length > 0 && (kind === 'NEW' ? quantity > 0 : driveUrl.trim())

  const add = () => {
    const creative: ProductLaunch['creative'] =
      kind === 'OWN_DRIVE'
        ? { kind: 'OWN_DRIVE', driveUrl: driveUrl.trim() }
        : { kind: 'NEW', quantity, angle: angle.trim() || undefined, direction: direction.trim() || undefined, references: parseReferences(refs) }
    let ok = true
    for (const countryId of countryIds) {
      const input: ProductLaunchInput = { productName, countryId, instructions, creative, conceptType, priority }
      if (!queueProduct(input)) {
        ok = false
        break
      }
    }
    if (ok) {
      show({
        tone: 'success',
        kind: 'Queued',
        title: productName.trim(),
        body: `${countryIds.length === 1 ? 'One market' : `${countryIds.length} markets`} — setup picks the ad account and places it.`,
        ms: 8000,
      })
      onClose()
    }
  }

  return (
    <Drawer
      title="New product to launch"
      subtitle="You say what and where; setup says which ad account."
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-fg-secondary">
            {countryIds.length === 0 ? 'Pick at least one market.' : `One queue entry per market (${countryIds.length}).`}
          </span>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={add}>
            Add to queue
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
      <Section n={1} title="Product and markets">
        <Field label="Product" hint="An existing product is reused by name; a new one is created when setup places it.">
          <input className={inputClass} list="queue-products" value={productName} placeholder="e.g. GumRevive" onChange={(e) => setProductName(e.target.value)} />
          <datalist id="queue-products">
            {db.products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </Field>
        <span className="block mb-1.5 text-[11px] font-medium tracking-[0.045em] uppercase text-fg-secondary">Markets</span>
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {db.countries.map((c) => {
            const on = countryIds.includes(c.id)
            return (
              <Button
                key={c.id}
                size="sm"
                variant={on ? 'primary' : 'default'}
                aria-pressed={on}
                onClick={() => setCountryIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
              >
                {c.code}
              </Button>
            )
          })}
        </div>
        <Field label="Instructions for setup" hint="Offer, landing page, budget, anything they need. Shown on the setup task.">
          <textarea className={textareaClass} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
      </Section>

      <Section n={2} title="Creatives">
        <OptionList<CreativeKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'NEW', title: 'Yzah makes them', desc: 'Yzah gets the task right now; the setup task waits for her creatives.' },
            { value: 'OWN_DRIVE', title: 'I have them in Drive', desc: 'Paste the folder; the setup task starts Ready.' },
          ]}
        />
        <div className="mt-3">
          {kind === 'OWN_DRIVE' ? (
            <Field label="Google Drive link">
              <input className={inputClass} value={driveUrl} placeholder="https://drive.google.com/…" onChange={(e) => setDriveUrl(e.target.value)} />
            </Field>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="How many">
                  <input className={inputClass} type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
                </Field>
                <Field label="Priority">
                  <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as CreativePriority)}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Creative angle (optional)">
                <input className={inputClass} value={angle} onChange={(e) => setAngle(e.target.value)} />
              </Field>
              <Field label="What to make (optional)">
                <textarea className={textareaClass} value={direction} onChange={(e) => setDirection(e.target.value)} />
              </Field>
              <Field label="References (optional)" hint="One link per line, a note after the link if it helps.">
                <textarea className={cn(textareaClass, 'font-mono text-xs')} value={refs} onChange={(e) => setRefs(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Framework" hint="Names the first ad set: today's date + the framework label.">
            <select className={selectClass} value={conceptType} onChange={(e) => setConceptType(e.target.value as ConceptType)}>
              {(['SWIPES', 'SWIPES_PLAYBOOK', 'ITERATION', 'VARIATION', 'DEEP_ITERATION', 'CUSTOM'] as ConceptType[]).map((t) => (
                <option key={t} value={t}>
                  {CONCEPT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <p className={hintClass}>The CBO is named NEW &lt;product&gt; &lt;account number&gt; in whichever account setup picks.</p>
        </div>
      </Section>
    </Drawer>
  )
}
