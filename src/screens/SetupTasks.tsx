// Karl & Christian's setup queue (PRD §10), also used by Charles to see all setup
// work. Execution-focused and copy-safe: no exact name is ever retyped.
//
// One shared queue, no assignment — Karl and Christian split the work between
// themselves. Whoever hits Complete is recorded as the setup person. A task is
// Waiting (on creative), Ready, or Completed — and can carry a blocker (BM
// restriction, disabled account…) that everyone who sees setup work sees too.

import { useState } from 'react'

import { now } from '../clock'
import { useToast } from '../components/Toaster'
import {
  Block,
  Button,
  Callout,
  CheckButton,
  Chip,
  cn,
  CopyButton,
  CopyRow,
  Drawer,
  EmptyState,
  Field,
  NameTd,
  PageHead,
  Section,
  Segmented,
  StackedTd,
  Stats,
  TableWrap,
  Td,
  textareaClass,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import {
  AccountStatusChip,
  BlockedChip,
  isAccountProblem,
  LAUNCH_MODE_LABEL,
  SetupStatusChip,
} from '../labels'
import { dueLabel, formatLaunchDate, formatTime, isLate } from '../naming'
import { rowForSetupTask, setupRows, userName } from '../selectors'
import { useActions, useStore } from '../store'

type Tab = 'OPEN' | 'BLOCKED' | 'DONE' | 'ALL'

export function SetupTasks() {
  const { db, currentUser } = useStore()
  const [tab, setTab] = useState<Tab>('OPEN')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const today = now()

  const all = setupRows(db)
  const open = all.filter((r) => r.setupTask!.status !== 'COMPLETED')
  const blocked = open.filter((r) => r.setupTask!.blockedReason)
  const done = all.filter((r) => r.setupTask!.status === 'COMPLETED')
  const shown = tab === 'OPEN' ? open : tab === 'BLOCKED' ? blocked : tab === 'DONE' ? done : all

  const counts = {
    ready: open.filter((r) => r.setupTask!.status === 'READY').length,
    waiting: open.filter((r) => r.setupTask!.status === 'WAITING_FOR_CREATIVE').length,
    blocked: blocked.length,
    doneToday: done.filter(
      (r) => new Date(r.setupTask!.completedAt!).toDateString() === today.toDateString(),
    ).length,
    late: open.filter((r) => isLate(r.setupTask!.dueAt, today)).length,
  }

  return (
    <>
      <PageHead
        title="Setup Tasks"
        sub={
          currentUser.role === 'SETUP'
            ? 'One queue for you and your partner — take whatever is ready. Raise a blocker if Meta gets in the way.'
            : 'Every setup task. Exact names with one-click copy; completing a task makes the launch live.'
        }
      />

      <Toolbar>
        <Stats
          items={[
            { k: 'Ready', v: counts.ready, tone: 'success' },
            { k: 'Waiting', v: counts.waiting, tone: 'warn' },
            { k: 'Blocked', v: counts.blocked, tone: counts.blocked ? 'danger' : 'quiet' },
            { k: 'Done today', v: counts.doneToday, tone: 'info' },
            { k: 'Late', v: counts.late, tone: counts.late ? 'danger' : 'quiet' },
          ]}
        />
        <span className="flex-1" />
        <Segmented
          ariaLabel="Scope"
          value={tab}
          options={[
            { value: 'OPEN' as Tab, label: `Open (${open.length})` },
            { value: 'BLOCKED' as Tab, label: `Blocked (${blocked.length})` },
            { value: 'DONE' as Tab, label: 'Completed' },
            { value: 'ALL' as Tab, label: 'All' },
          ]}
          onChange={setTab}
        />
      </Toolbar>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === 'BLOCKED' ? 'Nothing is blocked.' : 'No setup tasks today.'}
          hint={tab === 'BLOCKED' ? 'Good.' : 'New setup tasks created by Charles will appear here.'}
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th title="Mark's non-blocking QA marker">QA</Th>
              <Th>Due</Th>
              <Th>Product</Th>
              <Th>Ad Account</Th>
              <Th>Campaign</Th>
              <Th>Ad Set</Th>
              <Th>Creative</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const t = r.setupTask!
              const late = t.status !== 'COMPLETED' && isLate(t.dueAt, today)
              return (
                <Tr key={t.id} onClick={() => setOpenTaskId(t.id)}>
                  <Td late={late || Boolean(t.blockedReason)} className="w-9">
                    <CheckButton
                      checked={Boolean(t.checkedAt)}
                      title={t.checkedAt ? `QA checked by ${userName(db, t.checkedBy)}` : 'Not checked by QA'}
                    />
                  </Td>
                  <StackedTd
                    className={cn(!late && 'text-fg-secondary')}
                    primary={t.status === 'COMPLETED' ? formatLaunchDate(new Date(t.dueAt)) : dueLabel(t.dueAt, today)}
                    secondary={
                      t.completedAt
                        ? `${userName(db, t.completedBy)} · ${formatTime(t.completedAt)}`
                        : formatTime(t.dueAt)
                    }
                  />
                  <StackedTd primary={r.product.name} secondary={r.countryCode} />
                  <NameTd value={r.account.displayName} />
                  <NameTd value={r.campaign.name} />
                  <NameTd value={r.adset.name} />
                  <Td className="whitespace-nowrap text-fg-secondary">
                    {t.creativeRequired
                      ? r.batch?.driveUrl
                        ? 'Ready'
                        : 'Waiting'
                      : r.launch.launchMode === 'OWN_BATCH'
                        ? 'From Charles'
                        : 'Reused'}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <SetupStatusChip status={t.status} short late={late} />
                      {t.blockedReason && <BlockedChip reason={t.blockedReason} />}
                    </span>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </TableWrap>
      )}

      {openTaskId && <SetupTaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  )
}

export function SetupTaskDrawer({
  taskId,
  onClose,
  forceReadOnly,
}: {
  taskId: string
  onClose: () => void
  forceReadOnly?: boolean
}) {
  const { db, currentUser, error, clearError } = useStore()
  const { completeSetup } = useActions()
  const { show } = useToast()
  const row = rowForSetupTask(db, taskId)
  const task = row?.setupTask

  if (!row || !task) {
    return (
      <Drawer title="Setup task" onClose={onClose}>
        <p className="text-fg-secondary">This task no longer exists.</p>
      </Drawer>
    )
  }

  const canAct = !forceReadOnly && currentUser.role === 'SETUP'
  const waiting = task.status === 'WAITING_FOR_CREATIVE'
  const completed = task.status === 'COMPLETED'
  const driveUrl = row.batch?.driveUrl

  // §10.4 — one plain-text block to paste into Meta notes or a chat.
  const setupBlock = [
    `Ad Account: ${row.account.displayName}`,
    `Campaign: ${row.campaign.name}`,
    `Ad Set: ${row.adset.name}`,
    `Creative: ${driveUrl ?? 'pending'}`,
  ].join('\n')

  const dot = <span className="px-1.5 text-line-strong">·</span>

  return (
    <Drawer
      title={`${row.product.name} · ${row.countryCode}`}
      subtitle={
        <>
          <SetupStatusChip status={task.status} />
          {task.blockedReason && (
            <>
              {' '}
              <BlockedChip reason={task.blockedReason} />
            </>
          )}
          {dot}
          {completed
            ? `${userName(db, task.completedBy)} · ${formatTime(task.completedAt!)}`
            : `due ${new Date(task.dueAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}`}
        </>
      }
      onClose={onClose}
      footer={
        canAct ? (
          <>
            <CopyButton value={setupBlock} label="Copy setup block" size="md" />
            <span className="flex-1" />
            <Button
              variant="primary"
              disabled={waiting || completed}
              title={waiting ? 'Creative has not been submitted yet.' : undefined}
              onClick={() => {
                if (completeSetup(task.id)) {
                  // The confirmation the setup person needs: it registered, here
                  // are the exact names, and the rest of the team knows.
                  show({
                    tone: 'success',
                    kind: 'Launched',
                    title: `${row.adset.name} · ${row.campaign.name}`,
                    body: `Recorded as live in ${row.account.displayName}. Charles, Danny and Mark can see it now.`,
                    ms: 9000,
                  })
                  onClose()
                }
              }}
            >
              {completed ? 'Completed' : 'Complete'}
            </Button>
          </>
        ) : (
          <>
            <SetupStatusChip status={task.status} />
            <span className="flex-1" />
            <CopyButton value={setupBlock} label="Copy setup block" />
          </>
        )
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

      {isAccountProblem(row.account.status) && (
        <Callout tone="danger">
          <div className="flex items-center gap-2 mb-1">
            <AccountStatusChip status={row.account.status} />
            <strong>{row.account.displayName}</strong>
          </div>
          {row.account.statusReason}
          <div className="mt-1 text-xs text-fg-secondary">
            Account-level problem — it affects every task on this account, not just this one.
            Update it from the Ad Accounts directory.
          </div>
        </Callout>
      )}

      <BlockerSection taskId={task.id} canEdit={canAct} />

      {waiting && (
        <Callout>
          <strong>Waiting for creative.</strong> Yzah has not submitted the Drive link yet. This
          task becomes <em>Ready</em> the moment she does.
        </Callout>
      )}

      <Section title="Copy into Meta">
        <CopyRow label="Ad account" value={row.account.displayName} />
        <CopyRow label="Campaign" value={row.campaign.name} />
        <CopyRow label="Ad set" value={row.adset.name} />
        <CopyRow label="Creative Drive" value={driveUrl ?? 'Pending — not submitted yet'} href={driveUrl} />
      </Section>

      <Section title="What this launch is">
        <Block>
          {[
            `MODE       ${LAUNCH_MODE_LABEL[row.launch.launchMode]}`,
            `CREATIVE   ${
              task.creativeRequired
                ? 'new work required'
                : row.launch.launchMode === 'OWN_BATCH'
                  ? 'supplied by Charles — no creative task'
                  : 'reused exactly — no creative task'
            }`,
            row.launch.launchMode === 'OWN_BATCH' && row.batch?.direction
              ? `NOTE       ${row.batch.direction}`
              : null,
            row.creativeTask
              ? `SUBMITTED  ${row.creativeTask.submittedAt ? formatTime(row.creativeTask.submittedAt) : 'not yet'}`
              : null,
            row.creativeTask?.submissionNote ? `NOTE       ${row.creativeTask.submissionNote}` : null,
            task.completedAt ? `COMPLETED  ${formatTime(task.completedAt)} by ${userName(db, task.completedBy)}` : null,
          ]
            .filter(Boolean)
            .join('\n')}
        </Block>
      </Section>

      <QaSection taskId={task.id} />

      {row.sourceAdset && (
        <Section title="Source history (context only)">
          <Block>
            {[
              `SOURCE CAMPAIGN  ${row.sourceCampaign?.name ?? '—'}`,
              `SOURCE AD SET    ${row.sourceAdset.name}`,
            ].join('\n')}
          </Block>
          <Callout className="mt-3 mb-0">
            Build against the <strong>destination</strong> names above. The source names are
            history and must never be typed into Meta.
          </Callout>
        </Section>
      )}

      {!canAct && (
        <Section title="Permissions">
          <p className="m-0 text-fg-secondary">
            {currentUser.role === 'SETUP_QA' ? (
              <>Setup visibility only — you can inspect, copy and mark QA checked, but completion belongs to Karl and Christian.</>
            ) : (
              <>
                Read-only here. Completing setup is <Chip tone="quiet">SETUP</Chip> work.
              </>
            )}
          </p>
        </Section>
      )}
    </Drawer>
  )
}

/**
 * Blockers — raised and cleared by the setup team. Shown to everyone who can see
 * setup work, because a blocked launch is the one thing Charles needs to know
 * about before he plans the next one on the same account.
 */
function BlockerSection({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const { db, currentUser } = useStore()
  const { setBlocker } = useActions()
  const { show } = useToast()
  const task = db.setupTasks.find((t) => t.id === taskId)
  const row = rowForSetupTask(db, taskId)
  const [reason, setReason] = useState('')
  const [raising, setRaising] = useState(false)

  if (!task || !row || task.status === 'COMPLETED') return null
  const editable = canEdit || currentUser.role === 'SETUP'
  const where = `${row.adset.name} · ${row.campaign.name}`

  if (task.blockedReason) {
    return (
      <Callout tone="danger">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <strong>⛔ Blocked</strong> — {task.blockedReason}
            <div className="mt-1 text-xs text-fg-secondary">
              {userName(db, task.blockedBy)}
              {task.blockedAt && ` · ${formatTime(task.blockedAt)}`}
            </div>
          </div>
          {editable && (
            <Button
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => {
                if (setBlocker(task.id, undefined)) {
                  show({
                    tone: 'success',
                    kind: 'Unblocked',
                    title: where,
                    body: 'Blocker cleared — the task is back in the queue and Charles has been notified.',
                  })
                }
              }}
            >
              Clear blocker
            </Button>
          )}
        </div>
      </Callout>
    )
  }

  if (!editable) return null

  return (
    <div className="mb-4">
      {raising ? (
        <div className="p-3 border border-danger-border rounded-lg bg-danger-bg/40">
          <Field label="What is blocking this?" hint="BM restriction, account disabled, payment method, policy hold…">
            <textarea
              className={textareaClass}
              value={reason}
              autoFocus
              placeholder="e.g. BM restricted — account under Meta review"
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                if (setBlocker(task.id, reason)) {
                  show({
                    tone: 'danger',
                    kind: 'Blocked',
                    title: where,
                    body: `Blocker raised: ${reason.trim()}. Charles, Danny and Mark can see it.`,
                    ms: 9000,
                  })
                  setReason('')
                  setRaising(false)
                }
              }}
            >
              Raise blocker
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRaising(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setRaising(true)}>
          ⛔ Raise a blocker
        </Button>
      )}
    </div>
  )
}

/**
 * QA check (§11.2). Mark can tick a record and leave a note; everyone else sees the
 * state read-only. Nothing in the app branches on `checkedAt`.
 */
function QaSection({ taskId }: { taskId: string }) {
  const { db, currentUser } = useStore()
  const { setQaCheck } = useActions()
  const { show } = useToast()
  const task = db.setupTasks.find((t) => t.id === taskId)
  const row = rowForSetupTask(db, taskId)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  if (!task) return null
  const isQa = currentUser.role === 'SETUP_QA'
  const checked = Boolean(task.checkedAt)

  return (
    <Section
      title="QA check"
      trailing={
        <CheckButton
          checked={checked}
          showLabel
          onToggle={
            isQa
              ? () => {
                  if (setQaCheck(task.id, !checked, checked ? undefined : note)) {
                    show({
                      tone: checked ? 'quiet' : 'info',
                      kind: checked ? 'QA cleared' : 'QA checked',
                      title: row ? `${row.adset.name} · ${row.campaign.name}` : task.id,
                      body: checked ? 'Check removed.' : 'Recorded. This never blocks anything.',
                    })
                  }
                  if (!checked) {
                    setNote('')
                    setNoteOpen(false)
                  }
                }
              : undefined
          }
        />
      }
    >
      {checked ? (
        <Block>
          {[
            `CHECKED BY  ${userName(db, task.checkedBy)}`,
            `CHECKED AT  ${new Date(task.checkedAt!).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}`,
            task.checkNote ? `NOTE        ${task.checkNote}` : null,
          ]
            .filter(Boolean)
            .join('\n')}
        </Block>
      ) : (
        <p className="m-0 text-fg-secondary">
          Not checked yet.{' '}
          {isQa
            ? 'Ticking this records that you looked — it does not gate the launch.'
            : 'Only Mark can set this, and nothing waits on it.'}
        </p>
      )}

      {isQa && !checked && (
        <div className="mt-2.5">
          {noteOpen ? (
            <Field label="Note (optional)">
              <textarea
                className={textareaClass}
                value={note}
                placeholder="Anything you noticed while checking…"
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
              + Add a note
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}
