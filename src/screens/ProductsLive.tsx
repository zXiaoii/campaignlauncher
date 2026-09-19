// Products Live — the store seat's one screen. Which products are being advertised
// in which market right now, so the person who owns Funnelish and Shopify knows
// exactly which funnels and listings have to be working. Four columns, one per
// market; each product carries two ticks, Funnelish and Shopify, that record
// "I checked this, it is fine" with a name and a time. Like Mark's QA tick they
// gate nothing — ads do not wait on them.

import { useState } from 'react'

import { now } from '../clock'
import { Chip, cn, EmptyState, mono, PageHead, Segmented, Toolbar } from '../components/ui'
import { canWrite } from '../permissions'
import { liveProductsInCountry, userName, type LiveProduct } from '../selectors'
import { useActions, useStore } from '../store'
import type { Country, StoreChannel } from '../types'

const CHANNELS: { key: StoreChannel; label: string }[] = [
  { key: 'funnelish', label: 'Funnelish' },
  { key: 'shopify', label: 'Shopify' },
]

type Filter = 'ALL' | 'TODO'

const DAY_MS = 86_400_000

export function ProductsLive() {
  const { db, currentUser } = useStore()
  const [filter, setFilter] = useState<Filter>('ALL')
  const editable = canWrite(currentUser.role, 'storeChecks')

  const markets = db.countries.map((country) => ({ country, products: liveProductsInCountry(db, country.id) }))
  const isDone = (countryId: string, lp: LiveProduct) =>
    CHANNELS.every((c) => Boolean(lp.product.storeChecks?.[countryId]?.[c.key]))
  const total = markets.reduce((n, m) => n + m.products.length, 0)
  const todo = markets.reduce((n, m) => n + m.products.filter((lp) => !isDone(m.country.id, lp)).length, 0)
  const distinct = new Set(markets.flatMap((m) => m.products.map((lp) => lp.product.id))).size

  return (
    <>
      <PageHead
        title={
          <>
            Products Live <Chip tone="accent">{distinct} products</Chip>
            {todo > 0 ? <Chip tone="warn">{todo} to check</Chip> : total > 0 ? <Chip tone="success">all checked</Chip> : null}
          </>
        }
        sub="Every product with ads running, by market. Tick Funnelish and Shopify once the funnel and the store listing are fine for that market."
      />

      <Toolbar>
        <Segmented
          ariaLabel="Show"
          value={filter}
          options={[
            { value: 'ALL' as Filter, label: `All live (${total})` },
            { value: 'TODO' as Filter, label: `Still to check (${todo})` },
          ]}
          onChange={setFilter}
        />
        <span className="flex-1" />
        <span className="text-xs text-fg-tertiary">
          A product appears here the moment a CBO for it has an ad set running, and leaves when its CBOs are killed.
        </span>
      </Toolbar>

      {total === 0 ? (
        <EmptyState title="Nothing is live yet." hint="Products appear here as soon as a campaign for them is running in a market." />
      ) : (
        <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {markets.map(({ country, products }) => {
            const shown = filter === 'TODO' ? products.filter((lp) => !isDone(country.id, lp)) : products
            return (
              <section key={country.id} className="border border-line rounded-xl bg-surface shadow-highlight overflow-hidden">
                <header className="flex items-center gap-2 px-3.5 py-2.5 border-b border-line bg-bg-subtle">
                  <span className="font-semibold">{country.code}</span>
                  <span className="text-xs text-fg-tertiary">{country.name}</span>
                  <span className="ml-auto text-xs text-fg-secondary">
                    {products.length} {products.length === 1 ? 'product' : 'products'}
                  </span>
                </header>
                {shown.length === 0 ? (
                  <p className="m-0 px-3.5 py-4 text-[13px] text-fg-tertiary">
                    {products.length === 0 ? 'No products live here.' : 'Everything here is checked.'}
                  </p>
                ) : (
                  shown.map((lp) => <ProductRow key={lp.product.id} country={country} live={lp} editable={editable} />)
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

function ProductRow({ country, live, editable }: { country: Country; live: LiveProduct; editable: boolean }) {
  const { db } = useStore()
  const { setStoreCheck } = useActions()
  const checks = live.product.storeChecks?.[country.id] ?? {}
  const fresh = live.latestLaunchAt ? now().getTime() - new Date(live.latestLaunchAt).getTime() < 3 * DAY_MS : false

  return (
    <div className="px-3.5 py-3 border-b border-line last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="font-medium truncate" title={live.product.name}>
          {live.product.name}
        </span>
        {fresh && (
          <Chip tone="info" title="An ad set for it went live in the last three days.">
            new activity
          </Chip>
        )}
        {live.allOnHold && (
          <Chip tone="quiet" title="Still running, but nothing new is being launched for it here.">
            on hold
          </Chip>
        )}
      </div>
      <div
        className={cn(mono, 'mt-0.5 text-fg-tertiary truncate')}
        title={live.campaigns.map((c) => c.name).join('\n')}
      >
        {live.campaigns.length} {live.campaigns.length === 1 ? 'CBO' : 'CBOs'} · {live.liveAdsets} ad{' '}
        {live.liveAdsets === 1 ? 'set' : 'sets'}
      </div>
      <div className="flex gap-1.5 mt-2">
        {CHANNELS.map((c) => {
          const check = checks[c.key]
          const title = check
            ? `${c.label} confirmed by ${userName(db, check.by)} · ${new Date(check.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : editable
              ? `Tick once ${c.label} is fine for ${live.product.name} in ${country.code}`
              : `${c.label} not confirmed yet`
          return (
            <button
              key={c.key}
              type="button"
              disabled={!editable}
              aria-pressed={Boolean(check)}
              title={title}
              onClick={() => setStoreCheck(live.product.id, country.id, c.key, !check)}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors',
                check
                  ? 'border-success-border bg-success-bg text-success'
                  : 'border-line-strong bg-surface-raised text-fg-secondary',
                editable ? 'cursor-pointer hover:border-line-focus' : 'cursor-default',
              )}
            >
              <span aria-hidden>{check ? '✓' : '○'}</span>
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
