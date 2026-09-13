// Day-by-day launches (PRD §12.2). Danny's home and Charles's Launches tab use the
// same component — Danny's copy simply has no create/edit controls.

import { useState } from 'react'

import { now } from '../clock'
import {
  Button,
  cn,
  EmptyState,
  inputClass,
  mono,
  NameTd,
  PageHead,
  Segmented,
  selectClass,
  TableWrap,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import { CampaignTypeChip, SetupStatusChip } from '../labels'
import { addDays, formatDayLabel, formatTime, sameDay, toDateInputValue } from '../naming'
import { allLaunchRows, groupByAccount, launchesOnDay, userName } from '../selectors'
import { useStore } from '../store'
import type { CampaignType } from '../types'

const ALL = 'ALL'

export function DayView({
  title,
  subtitle,
  onOpenAdset,
  showInFlight,
}: {
  title: string
  subtitle: string
  onOpenAdset: (adsetId: string) => void
  showInFlight?: boolean
}) {
  const { db } = useStore()
  const today = now()
  const [day, setDay] = useState(today)
  const [countryId, setCountryId] = useState<string>(ALL)
  const [accountId, setAccountId] = useState<string>(ALL)
  const [productId, setProductId] = useState<string>(ALL)
  const [type, setType] = useState<string>(ALL)

  const matches = (r: ReturnType<typeof allLaunchRows>[number]) =>
    (countryId === ALL || r.account.countryId === countryId) &&
    (accountId === ALL || r.account.id === accountId) &&
    (productId === ALL || r.product.id === productId) &&
    (type === ALL || r.campaign.campaignType === type)

  const launched = launchesOnDay(db, day).filter(matches)
  const groups = groupByAccount(launched)

  const inFlight = allLaunchRows(db)
    .filter(
      (r) =>
        !r.launch.launchedAt && r.setupTask && sameDay(r.setupTask.dueAt, day) && matches(r),
    )
    .sort((a, b) => (a.setupTask!.dueAt < b.setupTask!.dueAt ? -1 : 1))

  const isToday = sameDay(day, today)
  const selectAuto = cn(selectClass, 'w-auto')

  return (
    <>
      <PageHead title={title} sub={subtitle}>
        <div className="flex items-center gap-2">
          <Button size="sm" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
            ‹
          </Button>
          <span className="min-w-[132px] text-center font-medium">{formatDayLabel(day)}</span>
          <Button size="sm" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
            ›
          </Button>
          <input
            className={cn(inputClass, 'w-[150px]')}
            type="date"
            value={toDateInputValue(day)}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split('-').map(Number)
              if (y && m && d) setDay(new Date(y, m - 1, d))
            }}
          />
          {!isToday && (
            <Button size="sm" onClick={() => setDay(today)}>
              Today
            </Button>
          )}
        </div>
      </PageHead>

      <Toolbar>
        <Segmented
          ariaLabel="Country"
          value={countryId}
          options={[
            ...db.countries.map((c) => ({ value: c.id, label: c.code })),
            { value: ALL, label: 'ALL' },
          ]}
          onChange={(v) => {
            setCountryId(v)
            setAccountId(ALL)
          }}
        />
        <select className={selectAuto} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value={ALL}>All ad accounts</option>
          {db.adAccounts
            .filter((a) => countryId === ALL || a.countryId === countryId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
        </select>
        <select className={selectAuto} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value={ALL}>All products</option>
          {db.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className={selectAuto} value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ALL}>All launch types</option>
          {(['NEW', 'SWE', 'REL', 'DIT'] as CampaignType[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <span className="whitespace-nowrap">
          <strong className="font-semibold">{launched.length}</strong>{' '}
          <span className="text-fg-secondary">
            launched {isToday ? 'today' : formatDayLabel(day)}
          </span>
        </span>
      </Toolbar>

      {groups.length === 0 ? (
        <EmptyState
          title={`Nothing launched on ${formatDayLabel(day)}.`}
          hint="Use ‹ › to move between days or clear the filters."
        />
      ) : (
        groups.map((group) => (
          <div
            key={group.account.id}
            className="mb-3 border border-line rounded-xl bg-surface shadow-highlight overflow-hidden"
          >
            <div className="flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 bg-bg-subtle border-b border-line">
              <span className="w-2.5 text-fg-tertiary">▾</span>
              <span className={cn(mono, 'font-medium text-[12.5px]')}>{group.account.displayName}</span>
              <span className="text-fg-tertiary">{group.countryCode}</span>
              <span className="ml-auto text-fg-secondary whitespace-nowrap">
                {group.campaigns.reduce((n, c) => n + c.rows.length, 0)} launched
              </span>
            </div>
            <div>
              {group.campaigns.map(({ campaign, rows }) => (
                <div key={campaign.id}>
                  <div className={cn(mono, 'px-3 pt-2.5 pb-[3px] text-[12.5px] font-medium')}>
                    {campaign.name} <CampaignTypeChip type={campaign.campaignType} />
                  </div>
                  {rows.map((r) => (
                    <div key={r.adset.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenAdset(r.adset.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onOpenAdset(r.adset.id)
                        }}
                        className="relative flex items-baseline gap-2 pl-[22px] pr-3 py-2 border-b border-line cursor-pointer transition-colors hover:bg-surface-hover before:content-['+'] before:absolute before:left-2.5 before:text-fg-tertiary"
                      >
                        <span className={cn(mono, 'text-[12.5px]')}>{r.adset.name}</span>
                        <span className="ml-auto pl-2 text-fg-secondary whitespace-nowrap">
                          Launched {formatTime(r.launch.launchedAt!)}
                          <span className="px-1.5 text-line-strong">•</span>
                          {userName(db, r.setupTask?.completedBy)}
                        </span>
                      </div>
                      {r.sourceAdset && (
                        <div className="pl-[22px] pr-3 pb-2 border-b border-line text-xs text-fg-tertiary">
                          Source: {r.sourceAdset.name}
                          {r.sourceCampaign && ` · ${r.sourceCampaign.name}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showInFlight && inFlight.length > 0 && (
        <>
          <h2 className="mt-[22px] mb-2.5 text-[13px] font-semibold text-fg-secondary">
            In flight for {formatDayLabel(day)} — not live yet
          </h2>
          <TableWrap className="max-h-none">
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Ad Set</Th>
                <Th>Account</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {inFlight.map((r) => (
                <Tr key={r.adset.id} onClick={() => onOpenAdset(r.adset.id)}>
                  <NameTd value={r.campaign.name} />
                  <NameTd value={r.adset.name} />
                  <NameTd value={r.account.displayName} muted />
                  <Td className="whitespace-nowrap">
                    <SetupStatusChip status={r.setupTask!.status} short />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}
