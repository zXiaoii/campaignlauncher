// Mark — setup-only QA / oversight (PRD §11).
//
// PERMISSION BOUNDARY: this file touches setup tasks and nothing else. No creative
// queue, no creative deadlines, no submission notes, no approval gate. Mark's nav
// (§2.1) has no route to Yzah's table, and the permission matrix backs that up.
//
// The QA checkmark lives here. §11.2 allows it on one condition — "it must remain
// non-blocking" — so it writes three fields on the setup task and nothing anywhere
// reads them to decide whether work may proceed.

import { useMemo, useState } from 'react'

import { now } from '../clock'
import {
  CheckButton,
  cn,
  EmptyState,
  inputClass,
  NameTd,
  PageHead,
  Segmented,
  selectClass,
  StackedTd,
  Stats,
  TableWrap,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import { BlockedChip, SetupStatusChip } from '../labels'
import { addDays, formatTime, isLate } from '../naming'
import { setupCounters, setupRows, setupRowsInWindow, userName } from '../selectors'
import { useActions, useStore } from '../store'
import type { SetupStatus } from '../types'
import { SetupTaskDrawer } from './SetupTasks'

type DayWindow = 'TODAY' | 'YESTERDAY' | 'WEEK'
type CheckFilter = 'ALL' | 'CHECKED' | 'UNCHECKED'
const ALL = 'ALL'

function windowRange(win: DayWindow, today: Date): [Date, Date] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
  if (win === 'TODAY') return [startOfDay(today), endOfDay(today)]
  if (win === 'YESTERDAY') {
    const y = addDays(today, -1)
    return [startOfDay(y), endOfDay(y)]
  }
  return [startOfDay(addDays(today, -6)), endOfDay(today)]
}

export function SetupOverview({ mode }: { mode: 'overview' | 'history' }) {
  const { db, currentUser } = useStore()
  const { setQaCheck } = useActions()
  const today = now()
  const [win, setWin] = useState<DayWindow>('TODAY')
  const [person, setPerson] = useState(ALL)
  const [status, setStatus] = useState<SetupStatus | typeof ALL>(ALL)
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('ALL')
  const [countryId, setCountryId] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const isQa = currentUser.role === 'SETUP_QA'
  const setupPeople = db.users.filter((u) => u.role === 'SETUP')
  const q = query.trim().toLowerCase()

  const base = useMemo(() => {
    if (mode === 'history') return setupRows(db)
    const [from, to] = windowRange(win, today)
    return setupRowsInWindow(db, from, to, today)
  }, [db, mode, win, today])

  // Country is a first-class filter (one click per market); the rest of the
  // dimensions — product, account, exact names — are a single search box.
  const countryCounts = base.reduce(
    (m, r) => ({ ...m, [r.account.countryId]: (m[r.account.countryId] ?? 0) + 1 }),
    {} as Record<string, number>,
  )
  const rows = base.filter((r) => {
    const t = r.setupTask!
    const checked = Boolean(t.checkedAt)
    const haystack = [
      r.countryCode,
      r.product.name,
      r.account.displayName,
      r.campaign.name,
      r.adset.name,
    ]
      .join(' ')
      .toLowerCase()
    return (
      (countryId === ALL || r.account.countryId === countryId) &&
      (person === ALL || t.completedBy === person) &&
      (status === ALL || t.status === status) &&
      (checkFilter === 'ALL' || (checkFilter === 'CHECKED' ? checked : !checked)) &&
      (!q || haystack.includes(q))
    )
  })

  const counters = setupCounters(rows, today)
  const completedRows = rows.filter((r) => r.setupTask!.status === 'COMPLETED')
  const checkedCount = completedRows.filter((r) => r.setupTask!.checkedAt).length
  const blockedCount = rows.filter((r) => r.setupTask!.blockedReason).length

  return (
    <>
      <PageHead
        title={mode === 'overview' ? 'Setup Overview' : 'Setup History'}
        sub={
          mode === 'overview'
            ? 'What Karl and Christian completed, what is still pending, and what is late.'
            : 'Every setup record, with the source/reuse indicator where one applies.'
        }
      />

      <Toolbar>
        <Stats
          items={[
            { k: 'Completed', v: counters.completed, tone: 'success' },
            { k: 'Ready', v: counters.ready, tone: 'info' },
            { k: 'Waiting', v: counters.waiting, tone: 'warn' },
            { k: 'Blocked', v: blockedCount, tone: blockedCount ? 'danger' : 'quiet' },
            { k: 'Late', v: counters.late, tone: counters.late ? 'danger' : 'quiet' },
            {
              k: 'QA',
              v: `${checkedCount}/${completedRows.length}`,
              tone: completedRows.length > 0 && checkedCount === completedRows.length ? 'success' : 'default',
            },
          ]}
        />
        <span className="flex-1" />
        {mode === 'overview' && (
          <Segmented
            ariaLabel="Window"
            value={win}
            options={[
              { value: 'TODAY' as DayWindow, label: 'Today' },
              { value: 'YESTERDAY' as DayWindow, label: 'Yesterday' },
              { value: 'WEEK' as DayWindow, label: 'Week' },
            ]}
            onChange={setWin}
          />
        )}
      </Toolbar>

      <Toolbar>
        <Segmented
          ariaLabel="Country"
          value={countryId}
          options={[
            { value: ALL, label: `All (${base.length})` },
            ...db.countries.map((c) => ({ value: c.id, label: `${c.code} (${countryCounts[c.id] ?? 0})` })),
          ]}
          onChange={setCountryId}
        />
        <Segmented
          ariaLabel="QA state"
          value={checkFilter}
          options={[
            { value: 'ALL' as CheckFilter, label: 'All' },
            { value: 'UNCHECKED' as CheckFilter, label: 'Unchecked' },
            { value: 'CHECKED' as CheckFilter, label: 'Checked' },
          ]}
          onChange={setCheckFilter}
        />
        <select className={cn(selectClass, 'w-auto')} value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value={ALL}>Completed by anyone</option>
          {setupPeople.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className={cn(selectClass, 'w-auto')}
          value={status}
          onChange={(e) => setStatus(e.target.value as SetupStatus | typeof ALL)}
        >
          <option value={ALL}>All statuses</option>
          <option value="WAITING_FOR_CREATIVE">Waiting for creative</option>
          <option value="READY">Ready</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <input
          className={cn(inputClass, 'min-w-[180px] flex-[0_1_260px]')}
          placeholder="Search country, product, account, name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="flex-1" />
        <span className="text-fg-secondary whitespace-nowrap">{rows.length} records</span>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          title={
            countryId !== ALL
              ? `No setup records for ${db.countries.find((c) => c.id === countryId)?.code ?? 'this market'} here.`
              : 'No setup records match these filters.'
          }
          hint="Clear a filter or pick another day."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th title="Non-blocking QA marker">QA</Th>
              <Th>Product</Th>
              <Th>Ad Account</Th>
              <Th>Campaign</Th>
              <Th>Ad Set</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Completed</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = r.setupTask!
              const late = t.status !== 'COMPLETED' && isLate(t.dueAt, today)
              const checked = Boolean(t.checkedAt)
              return (
                <Tr key={t.id} onClick={() => setOpenTaskId(t.id)}>
                  <Td late={late} className="w-9">
                    <CheckButton
                      checked={checked}
                      onToggle={isQa ? () => setQaCheck(t.id, !checked) : undefined}
                      title={
                        checked
                          ? `Checked by ${userName(db, t.checkedBy)} · ${formatTime(t.checkedAt!)}`
                          : isQa
                            ? 'Mark QA checked'
                            : 'Not checked by QA'
                      }
                    />
                  </Td>
                  <StackedTd primary={r.product.name} secondary={r.countryCode} />
                  <NameTd value={r.account.displayName} />
                  <NameTd value={r.campaign.name} />
                  <NameTd value={r.adset.name} />
                  <NameTd value={r.sourceAdset ? `↩ ${r.sourceAdset.name}` : '—'} muted />
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <SetupStatusChip status={t.status} short late={late} />
                      {t.blockedReason && <BlockedChip reason={t.blockedReason} />}
                    </span>
                  </Td>
                  {t.completedAt ? (
                    <StackedTd
                      primary={userName(db, t.completedBy)}
                      secondary={`${new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${formatTime(t.completedAt)}`}
                    />
                  ) : (
                    <StackedTd
                      className="text-fg-tertiary"
                      primary="—"
                      secondary={`due ${formatTime(t.dueAt)}`}
                    />
                  )}
                </Tr>
              )
            })}
          </tbody>
        </TableWrap>
      )}

      {openTaskId && <SetupTaskDrawer taskId={openTaskId} forceReadOnly onClose={() => setOpenTaskId(null)} />}
    </>
  )
}
