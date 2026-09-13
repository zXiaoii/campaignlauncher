// Danny's Overview — one screen, once a day: what everyone did, what is stuck,
// how each market stands, and whether launches are landing daily. Every number
// is derived from records the app already keeps; nothing here is typed in.
// Read-only by construction: it renders no action beyond opening an ad set.

import { useMemo, useState, type ReactNode } from 'react'

import { activityOnDay, KIND_LABEL, type ActivityKind, type ActivityLine } from '../activity'
import { now } from '../clock'
import {
  Button,
  Chip,
  cn,
  inputClass,
  mono,
  NameTd,
  PageHead,
  TableWrap,
  Td,
  Th,
  Tr,
  type ChipTone,
} from '../components/ui'
import { isAccountProblem } from '../labels'
import { addDays, formatDayLabel, formatTime, isLate, sameDay, toDateInputValue } from '../naming'
import {
  accountsInCountry,
  allLaunchRows,
  campaignsInAccount,
  isCampaignFull,
  killedCampaignsInAccount,
  launchesOnDay,
  liveAdsets,
  plannedAdsets,
  userName,
} from '../selectors'
import { planNextBatch, useStore } from '../store'
import type { Role, User } from '../types'

const ROLE_LABEL: Record<Role, string> = {
  MEDIA_BUYER: 'Media buyer',
  CEO: 'Executive',
  CREATIVE: 'Creative',
  SETUP: 'Setup',
  SETUP_QA: 'Setup QA',
}

const ROLE_TONE: Record<Role, ChipTone> = {
  MEDIA_BUYER: 'accent',
  CEO: 'quiet',
  CREATIVE: 'rose',
  SETUP: 'success',
  SETUP_QA: 'info',
}

const KIND_TONE: Record<ActivityKind, ChipTone> = {
  launch: 'accent',
  import: 'info',
  campaign: 'quiet',
  creative: 'rose',
  request: 'warn',
  setup: 'success',
  blocker: 'danger',
  qa: 'info',
  account: 'warn',
  team: 'quiet',
  other: 'quiet',
}

/** The order people appear in: the doers first, Danny last. */
const ROLE_ORDER: Role[] = ['MEDIA_BUYER', 'CREATIVE', 'SETUP', 'SETUP_QA', 'CEO']

export function Dashboard({ onOpenAdset }: { onOpenAdset: (adsetId: string) => void }) {
  const { db, currentUser } = useStore()
  const today = now()
  const [day, setDay] = useState(today)
  const isToday = sameDay(day, today)

  // ---- what everyone did on `day` ------------------------------------------
  const lines = useMemo(() => activityOnDay(db, day), [db, day])
  const byUser = useMemo(() => {
    const m = new Map<string, ActivityLine[]>()
    for (const l of lines) m.set(l.userId, [...(m.get(l.userId) ?? []), l])
    return m
  }, [lines])
  const people = [...db.users]
    .filter((u) => u.active || byUser.has(u.id))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sortOrder - b.sortOrder)

  // ---- right now ------------------------------------------------------------
  const rows = allLaunchRows(db)
  const open = rows.filter((r) => r.setupTask && r.setupTask.status !== 'COMPLETED')
  const waiting = open.filter((r) => r.setupTask!.status === 'WAITING_FOR_CREATIVE')
  const ready = open.filter((r) => r.setupTask!.status === 'READY')
  const blocked = open.filter((r) => r.setupTask!.blockedReason)
  const lateSetup = open.filter((r) => isLate(r.setupTask!.dueAt, today))
  const lateCreative = rows.filter((r) => r.creativeTask?.status === 'TODO' && isLate(r.creativeTask.dueAt, today))
  const requests = rows.filter((r) => r.creativeTask?.requestNote)
  const problemAccounts = db.adAccounts.filter((a) => isAccountProblem(a.status))
  const launchedOnDay = launchesOnDay(db, day)
  const weekAgo = addDays(today, -7)
  const launchedWeek = rows.filter((r) => r.launch.launchedAt && new Date(r.launch.launchedAt) >= weekAgo)

  // ---- markets --------------------------------------------------------------
  const markets = db.countries.map((c) => {
    const accounts = accountsInCountry(db, c.id)
    const cbos = accounts.flatMap((a) => campaignsInAccount(db, a.id))
    const killed = accounts.reduce((n, a) => n + killedCampaignsInAccount(db, a.id).length, 0)
    const accountIds = new Set(accounts.map((a) => a.id))
    return {
      country: c,
      accounts: accounts.length,
      problem: accounts.filter((a) => isAccountProblem(a.status)).length,
      cbos: cbos.length,
      live: cbos.reduce((n, cm) => n + liveAdsets(db, cm.id).filter((a) => a.status !== 'PLANNED').length, 0),
      ready: cbos.filter((cm) => !planNextBatch(db, cm.id, today).blockedReason).length,
      inFlight: cbos.reduce((n, cm) => n + plannedAdsets(db, cm.id).length, 0),
      full: cbos.filter((cm) => isCampaignFull(db, cm.id)).length,
      onHold: cbos.filter((cm) => cm.onHold).length,
      killed,
      launchedWeek: launchedWeek.filter((r) => accountIds.has(r.account.id)).length,
    }
  })

  // ---- last 14 days ---------------------------------------------------------
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const perDay = days.map((d) => ({ day: d, n: launchesOnDay(db, d).length }))
  const maxPerDay = Math.max(1, ...perDay.map((x) => x.n))

  // ---- needs attention --------------------------------------------------------
  const attention: { tone: ChipTone; tag: string; text: string; adsetId?: string; at?: string }[] = [
    ...blocked.map((r) => ({
      tone: 'danger' as ChipTone,
      tag: 'Blocked',
      text: `${r.adset.name} · ${r.campaign.name} — ${r.setupTask!.blockedReason} (${userName(db, r.setupTask!.blockedBy)})`,
      adsetId: r.adset.id,
      at: r.setupTask!.blockedAt,
    })),
    ...lateSetup
      .filter((r) => !r.setupTask!.blockedReason)
      .map((r) => ({
        tone: 'danger' as ChipTone,
        tag: r.setupTask!.status === 'READY' ? 'Setup late' : 'Waiting, late',
        text: `${r.adset.name} · ${r.campaign.name} — due ${formatDayLabel(new Date(r.setupTask!.dueAt))} ${formatTime(r.setupTask!.dueAt)}`,
        adsetId: r.adset.id,
        at: r.setupTask!.dueAt,
      })),
    ...lateCreative.map((r) => ({
      tone: 'warn' as ChipTone,
      tag: 'Creative late',
      text: `${r.adset.name} · ${r.campaign.name} — Yzah's deadline was ${formatDayLabel(new Date(r.creativeTask!.dueAt))}`,
      adsetId: r.adset.id,
      at: r.creativeTask!.dueAt,
    })),
    ...requests.map((r) => ({
      tone: 'warn' as ChipTone,
      tag: 'Request',
      text: `${userName(db, r.creativeTask!.assignee)} asked about ${r.adset.name} · ${r.campaign.name} — ${r.creativeTask!.requestNote}`,
      adsetId: r.adset.id,
      at: r.creativeTask!.requestAt,
    })),
    ...problemAccounts.map((a) => ({
      tone: 'warn' as ChipTone,
      tag: a.status.toLowerCase().replace('_', ' '),
      text: `${a.displayName}${a.statusReason ? ` — ${a.statusReason}` : ''}${a.statusChangedBy ? ` (${userName(db, a.statusChangedBy)})` : ''}`,
      at: a.statusChangedAt,
    })),
  ]

  return (
    <>
      <PageHead
        title="Overview"
        sub={
          currentUser.role === 'CEO'
            ? 'What everyone did, what is stuck, and how each market stands. Read-only.'
            : 'The same screen Danny sees.'
        }
      >
        <div className="flex items-center gap-2">
          <Button size="sm" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
            ‹
          </Button>
          <span className="min-w-[132px] text-center font-medium">{formatDayLabel(day)}</span>
          <Button size="sm" aria-label="Next day" disabled={isToday} onClick={() => setDay(addDays(day, 1))}>
            ›
          </Button>
          <input
            className={cn(inputClass, 'w-[150px]')}
            type="date"
            value={toDateInputValue(day)}
            max={toDateInputValue(today)}
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

      {/* ------------------------------------------------------ headline */}
      <div className="grid grid-cols-6 gap-2 mb-5 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-2">
        <Stat label={`Launched ${isToday ? 'today' : formatDayLabel(day)}`} value={launchedOnDay.length} tone="success" />
        <Stat label="Launched last 7 days" value={launchedWeek.length} tone="success" />
        <Stat label="In flight now" value={open.length} hint={`${waiting.length} waiting on creative · ${ready.length} ready for setup`} tone="info" />
        <Stat label="Blocked" value={blocked.length} tone={blocked.length ? 'danger' : 'quiet'} />
        <Stat label="Late" value={lateSetup.length + lateCreative.length} hint={`${lateSetup.length} setup · ${lateCreative.length} creative`} tone={lateSetup.length + lateCreative.length ? 'danger' : 'quiet'} />
        <Stat label="Problem accounts" value={problemAccounts.length} tone={problemAccounts.length ? 'warn' : 'quiet'} />
      </div>

      {/* ------------------------------------------------ what everyone did */}
      <H2>
        What everyone did {isToday ? 'today' : `on ${formatDayLabel(day)}`}
        <span className="ml-2 font-normal text-fg-tertiary">{lines.length} {lines.length === 1 ? 'action' : 'actions'}</span>
      </H2>
      <div className="grid grid-cols-2 gap-3 mb-6 max-[900px]:grid-cols-1">
        {people.map((u) => (
          <PersonCard key={u.id} user={u} lines={byUser.get(u.id) ?? []} onOpenAdset={onOpenAdset} />
        ))}
      </div>

      {/* ------------------------------------------------- needs attention */}
      <H2>
        Needs attention right now
        {attention.length > 0 && <Chip tone="danger">{attention.length}</Chip>}
      </H2>
      {attention.length === 0 ? (
        <div className="mb-6 px-4 py-3 border border-line rounded-lg bg-surface text-fg-secondary">
          Nothing stuck. No blockers, nothing late, no open requests, every account healthy.
        </div>
      ) : (
        <div className="mb-6 border border-line rounded-lg bg-surface overflow-hidden">
          {attention.map((a, i) => (
            <div
              key={i}
              role={a.adsetId ? 'button' : undefined}
              tabIndex={a.adsetId ? 0 : undefined}
              onClick={a.adsetId ? () => onOpenAdset(a.adsetId!) : undefined}
              onKeyDown={(e) => {
                if (a.adsetId && e.key === 'Enter') onOpenAdset(a.adsetId)
              }}
              className={cn(
                'flex items-start gap-2.5 px-3.5 py-2.5 border-b border-line last:border-b-0',
                a.adsetId && 'cursor-pointer transition-colors hover:bg-surface-hover',
              )}
            >
              <Chip tone={a.tone}>{a.tag}</Chip>
              <span className="min-w-0 flex-1 text-[13px]">{a.text}</span>
              {a.at && <span className="text-xs text-fg-tertiary whitespace-nowrap">{formatDayLabel(new Date(a.at))}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------- markets */}
      <H2>Markets</H2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <Th>Market</Th>
              <Th>Accounts</Th>
              <Th>CBOs</Th>
              <Th>Live ad sets</Th>
              <Th title="CBOs that can take a next batch right now">Ready</Th>
              <Th title="Ad sets planned, not yet live">In flight</Th>
              <Th>Full</Th>
              <Th>On hold</Th>
              <Th>Killed</Th>
              <Th>Launched, 7 days</Th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <Tr key={m.country.id}>
                <Td className="font-medium whitespace-nowrap">{m.country.name}</Td>
                <Td className="whitespace-nowrap">
                  {m.accounts}
                  {m.problem > 0 && (
                    <>
                      {' '}
                      <Chip tone="warn">{m.problem} problem</Chip>
                    </>
                  )}
                </Td>
                <Td>{m.cbos}</Td>
                <Td>{m.live}</Td>
                <Td className={cn(m.ready > 0 && 'text-success font-medium')}>{m.ready}</Td>
                <Td className={cn(m.inFlight > 0 && 'text-fg font-medium')}>{m.inFlight}</Td>
                <Td>{m.full}</Td>
                <Td>{m.onHold}</Td>
                <Td>{m.killed}</Td>
                <Td className={cn(m.launchedWeek > 0 && 'text-success font-medium')}>{m.launchedWeek}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* --------------------------------------------------- last 14 days */}
      <H2>
        Launch rhythm, last 14 days
        <span className="ml-2 font-normal text-fg-tertiary">
          {perDay.reduce((n, x) => n + x.n, 0)} launched
        </span>
      </H2>
      <div className="mb-6 px-4 pt-4 pb-2 border border-line rounded-lg bg-surface">
        <div className="flex items-end gap-1.5 h-[96px]">
          {perDay.map(({ day: d, n }) => (
            <button
              key={d.toISOString()}
              type="button"
              title={`${formatDayLabel(d)}: ${n} launched`}
              onClick={() => setDay(d)}
              className="flex-1 flex flex-col items-center justify-end h-full gap-1 group"
            >
              <span className={cn('text-[10.5px] tabular-nums', n ? 'text-fg-secondary' : 'text-fg-tertiary')}>{n || ''}</span>
              <span
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  sameDay(d, day) ? 'bg-accent' : n ? 'bg-success/70 group-hover:bg-success' : 'bg-line',
                )}
                style={{ height: `${Math.max(3, (n / maxPerDay) * 64)}px` }}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {perDay.map(({ day: d }) => (
            <span key={d.toISOString()} className="flex-1 text-center text-[10px] text-fg-tertiary">
              {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------- in flight list */}
      {open.length > 0 && (
        <>
          <H2>In flight now</H2>
          <TableWrap>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Ad Set</Th>
                <Th>Account</Th>
                <Th>Stage</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody>
              {open
                .sort((a, b) => (a.setupTask!.dueAt < b.setupTask!.dueAt ? -1 : 1))
                .map((r) => {
                  const t = r.setupTask!
                  const late = isLate(t.dueAt, today)
                  return (
                    <Tr key={r.adset.id} onClick={() => onOpenAdset(r.adset.id)}>
                      <NameTd value={r.campaign.name} />
                      <NameTd value={r.adset.name} />
                      <NameTd value={r.account.displayName} muted />
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex gap-1.5">
                          {t.blockedReason ? (
                            <Chip tone="danger">⛔ Blocked</Chip>
                          ) : t.status === 'WAITING_FOR_CREATIVE' ? (
                            <Chip tone="warn">Waiting on {userName(db, r.creativeTask?.assignee)}</Chip>
                          ) : (
                            <Chip tone="success">Ready for setup</Chip>
                          )}
                        </span>
                      </Td>
                      <Td late={late} className="whitespace-nowrap">
                        {formatDayLabel(new Date(t.dueAt))} {formatTime(t.dueAt)}
                      </Td>
                    </Tr>
                  )
                })}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ pieces

function H2({ children }: { children: ReactNode }) {
  return <h2 className="flex items-center gap-2 mt-1 mb-2.5 text-[13px] font-semibold text-fg-secondary">{children}</h2>
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone: ChipTone }) {
  const color: Record<string, string> = {
    success: 'text-success',
    danger: 'text-danger',
    warn: 'text-warn',
    info: 'text-info',
    accent: 'text-accent',
  }
  return (
    <div className="px-3.5 py-3 border border-line rounded-lg bg-surface shadow-highlight">
      <div className="text-[11px] uppercase tracking-[0.045em] text-fg-tertiary">{label}</div>
      <div className={cn('mt-1 text-[26px] leading-none font-semibold tabular-nums', color[tone] ?? 'text-fg')}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-fg-tertiary">{hint}</div>}
    </div>
  )
}

function PersonCard({
  user,
  lines,
  onOpenAdset,
}: {
  user: User
  lines: ActivityLine[]
  onOpenAdset: (adsetId: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const counts = lines.reduce(
    (m, l) => ({ ...m, [l.kind]: (m[l.kind] ?? 0) + 1 }),
    {} as Partial<Record<ActivityKind, number>>,
  )
  const summary = (Object.keys(counts) as ActivityKind[])
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .map((k) => `${counts[k]} ${KIND_LABEL[k]}`)
    .join(' · ')
  const shown = showAll ? lines : lines.slice(-8)
  const hidden = lines.length - shown.length

  return (
    <article className={cn('border border-line rounded-lg bg-surface-raised shadow-highlight', lines.length === 0 && 'opacity-70')}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-line">
        <span className="font-medium">{user.name}</span>
        <Chip tone={user.active ? ROLE_TONE[user.role] : 'quiet'}>{ROLE_LABEL[user.role]}</Chip>
        {!user.active && <Chip tone="quiet">deactivated</Chip>}
        <span className="ml-auto text-xs text-fg-secondary whitespace-nowrap">
          {lines.length === 0 ? (
            user.role === 'CEO' ? 'Watching' : 'Nothing recorded'
          ) : (
            <>
              <strong className="text-fg">{lines.length}</strong> {lines.length === 1 ? 'action' : 'actions'}
            </>
          )}
        </span>
      </div>
      {lines.length > 0 && (
        <>
          <div className="px-3.5 pt-2 text-xs text-fg-tertiary">{summary}</div>
          <ul className="m-0 p-0 list-none">
            {hidden > 0 && (
              <li className="px-3.5 py-1.5">
                <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                  Show {hidden} earlier
                </Button>
              </li>
            )}
            {shown.map((l) => (
              <li
                key={l.id}
                role={l.adsetId ? 'button' : undefined}
                tabIndex={l.adsetId ? 0 : undefined}
                onClick={l.adsetId ? () => onOpenAdset(l.adsetId!) : undefined}
                onKeyDown={(e) => {
                  if (l.adsetId && e.key === 'Enter') onOpenAdset(l.adsetId)
                }}
                className={cn(
                  'flex items-start gap-2.5 px-3.5 py-2 border-t border-line first:border-t-0',
                  l.adsetId && 'cursor-pointer transition-colors hover:bg-surface-hover',
                )}
              >
                <span className={cn(mono, 'pt-0.5 text-fg-tertiary whitespace-nowrap')}>{formatTime(l.at)}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug">{l.text}</span>
                <Chip tone={KIND_TONE[l.kind]}>{KIND_LABEL[l.kind]}</Chip>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
