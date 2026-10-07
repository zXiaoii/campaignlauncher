// Yzah's creative-task table and drawer (PRD §9). Charles sees the same table for
// all tasks and sets priority; Danny gets a read-only summary. Mark sees it too: he
// and Charles write the brief — angle, direction, hooks, reference ads — because "C2
// iterations" on its own tells Yzah nothing, and since 8 Oct 2026 Mark can also make
// the creatives himself and submit the Drive link, as a second creative.
//
// Yzah can edit her submission any time before setup completes the launch, and
// can raise a request back to Charles ("need the full batch") that shows as a flag
// on the task until Charles clears it.

import { useState } from 'react'

import { now } from '../clock'
import { useToast } from '../components/Toaster'
import {
  Block,
  Button,
  Callout,
  Chip,
  cn,
  CopyButton,
  Drawer,
  EmptyState,
  Field,
  inputClass,
  LinkButton,
  mono,
  NameTd,
  PageHead,
  Section,
  Segmented,
  StackedTd,
  Stats,
  TableWrap,
  Td,
  textareaClass,
  TextRow,
  Th,
  Toolbar,
  Tr,
} from '../components/ui'
import {
  CONCEPT_TYPE_LABEL,
  CreativeStatusChip,
  PRIORITIES,
  PRIORITY_LABEL,
  PriorityChip,
  RequestChip,
  SetupStatusChip,
} from '../labels'
import { dueLabel, formatLaunchDate, formatTime, isLate } from '../naming'
import { canWrite } from '../permissions'
import { adsetsInCampaign, creativeRows, rowForCreativeTask, userName } from '../selectors'
import { useActions, useStore } from '../store'
import type { CreativeBatch, CreativePriority, CreativeReference } from '../types'

type Filter = 'OPEN' | 'NEEDS_BRIEF' | 'ALL'

/** Nothing for Yzah to go on: no angle, no direction, no hooks, no reference. */
function briefIsEmpty(b: CreativeBatch | undefined): boolean {
  return !b || (!b.angle?.trim() && !b.direction?.trim() && b.hooks.length === 0 && b.references.length === 0)
}

/** One reference per line: the link, then (optionally) what it is. */
function parseReferences(text: string): CreativeReference[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [url, ...rest] = l.split(/\s+/)
      const label = rest.join(' ').replace(/^[-–—:|]\s*/, '').trim()
      return { url, label: label || undefined }
    })
}

const referencesText = (refs: CreativeReference[]) => refs.map((r) => (r.label ? `${r.url} ${r.label}` : r.url)).join('\n')

export function CreativeTasks() {
  const { db, currentUser } = useStore()
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const today = now()

  const isYzah = currentUser.role === 'CREATIVE'
  const canBrief = canWrite(currentUser.role, 'editBrief')

  let rows = creativeRows(db)
  if (isYzah) rows = rows.filter((r) => r.creativeTask!.assignee === currentUser.id)
  const open = rows.filter((r) => r.creativeTask!.status === 'TODO')
  const needsBrief = open.filter((r) => briefIsEmpty(r.batch))
  const shown = filter === 'OPEN' ? open : filter === 'NEEDS_BRIEF' ? needsBrief : rows

  const counts = {
    todo: open.length,
    high: open.filter((r) => r.creativeTask!.priority === 'HIGH').length,
    requests: rows.filter((r) => r.creativeTask!.requestNote).length,
    submitted: rows.filter((r) => r.creativeTask!.status === 'SUBMITTED').length,
    late: open.filter((r) => isLate(r.creativeTask!.dueAt, today)).length,
  }

  return (
    <>
      <PageHead
        title="Creative Tasks"
        sub={
          isYzah
            ? 'Highest priority first. Submit a Drive link to hand a task to setup — you can update it until the launch goes live.'
            : currentUser.role === 'SETUP_QA'
              ? 'Every creative task. Write the brief, or make the creatives yourself and submit the Drive link — either hands the task to setup.'
              : canBrief
                ? 'Every creative task. Open one to write its brief for Yzah — the angle, what to make, and the reference ads.'
                : 'Every creative task. A task exists only when creative work is actually required.'
        }
      />

      <Toolbar>
        <Stats
          items={[
            { k: 'To do', v: counts.todo, tone: 'info' },
            ...(canBrief ? [{ k: 'Needs brief', v: needsBrief.length, tone: (needsBrief.length ? 'warn' : 'quiet') as 'warn' | 'quiet' }] : []),
            { k: 'High', v: counts.high, tone: 'rose' as const },
            { k: 'Requests', v: counts.requests, tone: counts.requests ? 'warn' : 'quiet' },
            { k: 'Submitted', v: counts.submitted, tone: 'success' },
            { k: 'Late', v: counts.late, tone: counts.late ? 'danger' : 'quiet' },
          ]}
        />
        <span className="flex-1" />
        <Segmented
          ariaLabel="Filter"
          value={filter}
          options={[
            { value: 'OPEN' as Filter, label: `Open (${open.length})` },
            ...(canBrief ? [{ value: 'NEEDS_BRIEF' as Filter, label: `Needs brief (${needsBrief.length})` }] : []),
            { value: 'ALL' as Filter, label: 'All' },
          ]}
          onChange={setFilter}
        />
      </Toolbar>

      {shown.length === 0 ? (
        <EmptyState title="No creative tasks." hint="New creative work assigned by Charles will appear here." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Priority</Th>
              <Th>Due</Th>
              <Th>Product</Th>
              <Th>Campaign</Th>
              <Th>Ad Set</Th>
              <Th>Brief</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const t = r.creativeTask!
              const late = t.status === 'TODO' && isLate(t.dueAt, today)
              return (
                <Tr key={t.id} onClick={() => setOpenTaskId(t.id)}>
                  <Td late={late} className="whitespace-nowrap">
                    <PriorityChip priority={t.priority} />
                  </Td>
                  <StackedTd
                    className={cn(!late && 'text-fg-secondary')}
                    primary={t.status === 'TODO' ? dueLabel(t.dueAt, today) : formatLaunchDate(new Date(t.dueAt))}
                    secondary={t.submittedAt ? `submitted ${formatTime(t.submittedAt)}` : formatTime(t.dueAt)}
                  />
                  <StackedTd primary={r.product.name} secondary={r.countryCode} />
                  <NameTd value={r.campaign.name} />
                  <NameTd value={r.adset.name} />
                  <StackedTd
                    className="text-fg-secondary"
                    primary={CONCEPT_TYPE_LABEL[r.adset.conceptType]}
                    secondary={`${t.quantity} creatives`}
                  />
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <CreativeStatusChip status={t.status} />
                      {t.requestNote && <RequestChip note={t.requestNote} />}
                      {canBrief && t.status === 'TODO' && briefIsEmpty(r.batch) && (
                        <Chip tone="warn" title="No angle, direction, hooks or references yet — open the task to write the brief.">
                          needs brief
                        </Chip>
                      )}
                    </span>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </TableWrap>
      )}

      {openTaskId && <CreativeTaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  )
}

/**
 * The CBO's most recent ad sets, for whoever is writing the brief: what went live,
 * when, with which framework, and the Drive folder when the app has it — so the
 * next swipes are chosen against what ran, not from memory.
 */
function PreviousAdsets({ campaignId, excludeAdsetId }: { campaignId: string; excludeAdsetId: string }) {
  const { db } = useStore()
  const previous = adsetsInCampaign(db, campaignId)
    .filter((a) => a.id !== excludeAdsetId && a.status !== 'PLANNED')
    .sort((a, b) => ((a.launchedAt ?? '') < (b.launchedAt ?? '') ? 1 : -1))
    .slice(0, 4)
  if (previous.length === 0) {
    return <p className="m-0 text-fg-secondary">Nothing has run in this CBO yet — this is its first batch.</p>
  }
  return (
    <div className="grid gap-1.5">
      {previous.map((a) => {
        const b = db.creativeBatches.find((x) => x.id === a.creativeBatchId)
        return (
          <div key={a.id} className="px-3 py-2 border border-line rounded-lg bg-surface">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={cn(mono, 'font-medium')}>{a.name}</span>
              <span className="text-xs text-fg-secondary">{CONCEPT_TYPE_LABEL[a.conceptType]}</span>
              <Chip tone={a.status === 'ACTIVE' ? 'success' : 'quiet'}>{a.status === 'ACTIVE' ? 'live' : a.status.toLowerCase()}</Chip>
              {a.launchedAt && <span className="text-xs text-fg-tertiary">launched {formatLaunchDate(new Date(a.launchedAt))}</span>}
              <span className="flex-1" />
              {b?.driveUrl ? (
                <LinkButton href={b.driveUrl}>Open Drive</LinkButton>
              ) : (
                <span className="text-xs text-fg-tertiary" title="This ad set was imported from Meta — its ads live only there.">
                  ads in Meta only
                </span>
              )}
            </div>
            {(b?.angle || b?.direction) && (
              <div className="mt-1 text-xs text-fg-secondary">
                {b.angle && <strong className="text-fg font-medium">{b.angle}. </strong>}
                {b.direction}
              </div>
            )}
            {(b?.references.length ?? 0) > 0 && (
              <div className="mt-1 text-xs">
                {b!.references.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noreferrer" className="mr-3 text-accent border-b border-accent-border hover:border-accent">
                    {r.label ?? r.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CreativeTaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { db, currentUser, error, clearError } = useStore()
  const { submitCreative, setPriority, setRequest, setBrief } = useActions()
  const { show } = useToast()
  const row = rowForCreativeTask(db, taskId)
  const task = row?.creativeTask
  const batch = row?.batch
  const [drive, setDrive] = useState(batch?.driveUrl ?? '')
  const [note, setNote] = useState(task?.submissionNote ?? '')
  const [request, setRequestText] = useState(task?.requestNote ?? '')
  // The brief, as Charles or Mark is typing it.
  const [angle, setAngle] = useState(batch?.angle ?? '')
  const [direction, setDirection] = useState(batch?.direction ?? '')
  const [hooksText, setHooksText] = useState((batch?.hooks ?? []).join('\n'))
  const [refsText, setRefsText] = useState(referencesText(batch?.references ?? []))

  if (!row || !task) {
    return (
      <Drawer title="Creative task" onClose={onClose}>
        <p className="text-fg-secondary">This task no longer exists.</p>
      </Drawer>
    )
  }

  const isYzah = currentUser.role === 'CREATIVE'
  const isCharles = currentUser.role === 'MEDIA_BUYER'
  const canBrief = canWrite(currentUser.role, 'editBrief')
  // Yzah, and Mark as the second creative: both hand the Drive link to setup.
  const canSubmit = canWrite(currentUser.role, 'submitCreative')
  const briefDirty =
    angle.trim() !== (batch?.angle ?? '') ||
    direction.trim() !== (batch?.direction ?? '') ||
    hooksText.split('\n').map((h) => h.trim()).filter(Boolean).join('\n') !== (batch?.hooks ?? []).join('\n') ||
    referencesText(parseReferences(refsText)) !== referencesText(batch?.references ?? [])
  const iterates =
    row.launch.launchMode === 'DEEP_ITERATION' || row.launch.launchMode === 'REUSE_PLUS_NEW'
  const editable = task.status !== 'COMPLETED'
  const isUpdate = task.status === 'SUBMITTED'
  const hooks = batch?.hooks ?? []
  const dirty = drive.trim() !== (batch?.driveUrl ?? '') || note.trim() !== (task.submissionNote ?? '')
  const dot = <span className="px-1.5 text-line-strong">·</span>

  return (
    <Drawer
      title={`${row.product.name} · ${CONCEPT_TYPE_LABEL[row.adset.conceptType]}`}
      subtitle={
        <>
          <span className={mono}>{row.adset.name}</span>
          {dot}
          {task.quantity} creatives
          {dot}
          due{' '}
          {new Date(task.dueAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <PriorityChip priority={task.priority} />
          <CreativeStatusChip status={task.status} />
          {task.requestNote && <RequestChip note={task.requestNote} />}
          <span className="flex-1" />
          {canSubmit ? (
            <Button
              variant="primary"
              disabled={!editable || !drive.trim() || (isUpdate && !dirty)}
              title={
                !editable
                  ? 'Setup has completed this launch — locked.'
                  : !drive.trim()
                    ? 'A Google Drive link is required.'
                    : isUpdate && !dirty
                      ? 'No changes yet.'
                      : undefined
              }
              onClick={() => {
                if (submitCreative(task.id, drive, note)) {
                  show({
                    tone: 'success',
                    kind: isUpdate ? 'Updated' : 'Submitted',
                    title: `${row.adset.name} · ${row.campaign.name}`,
                    body: isUpdate
                      ? 'Drive link updated — setup sees the new one.'
                      : 'Handed to setup — Karl and Christian now see it as Ready.',
                    ms: 9000,
                  })
                  onClose()
                }
              }}
            >
              {isUpdate ? 'Update submission' : 'Submit'}
            </Button>
          ) : (
            <span className="text-xs text-fg-secondary">
              {canBrief ? 'The brief and priority are yours; the Drive link is Yzah’s or Mark’s.' : 'Read-only — this queue belongs to Yzah and Mark.'}
            </span>
          )}
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

      {/* Yzah's request, surfaced first for Charles — it is the thing he needs to act on. */}
      {task.requestNote && !isYzah && (
        <Callout className="border-l-warn">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <strong>Yzah asked:</strong> {task.requestNote}
              {task.requestAt && (
                <div className="mt-1 text-xs text-fg-tertiary">{formatTime(task.requestAt)}</div>
              )}
            </div>
            {isCharles && (
              <Button size="sm" className="ml-auto shrink-0" title="Clears Yzah's flag." onClick={() => setRequest(task.id, undefined)}>
                Handled
              </Button>
            )}
          </div>
        </Callout>
      )}

      {canBrief && (
        <Section title="Priority">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Priority"
              value={task.priority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              onChange={(p: CreativePriority) => setPriority(task.id, p)}
            />
            <span className="text-xs text-fg-tertiary">
              Moves this up or down Yzah&apos;s queue. Due date breaks ties.
            </span>
          </div>
        </Section>
      )}

      <Section title="Where this is going">
        <Block>
          {[
            `COUNTRY    ${row.countryCode}`,
            `ACCOUNT    ${row.account.displayName}`,
            `CAMPAIGN   ${row.campaign.name}`,
            `AD SET     ${row.adset.name}`,
          ].join('\n')}
        </Block>
      </Section>

      {canBrief && editable && (
        <Section title="What ran last in this CBO">
          <PreviousAdsets campaignId={row.campaign.id} excludeAdsetId={row.adset.id} />
        </Section>
      )}

      {canBrief && editable && (
        <Section
          title="Brief for Yzah"
          trailing={
            batch?.briefUpdatedBy ? (
              <span className="text-xs text-fg-tertiary">
                last written by {userName(db, batch.briefUpdatedBy)}
                {batch.briefUpdatedAt ? ` · ${formatLaunchDate(new Date(batch.briefUpdatedAt))} ${formatTime(batch.briefUpdatedAt)}` : ''}
              </span>
            ) : briefIsEmpty(batch) ? (
              <Chip tone="warn">needs brief</Chip>
            ) : undefined
          }
        >
          <Field label="Creative angle" hint="The idea in one line — e.g. “C3 angle: doctors hate this, from the wife’s point of view”.">
            <input className={inputClass} value={angle} placeholder="What is this batch about?" onChange={(e) => setAngle(e.target.value)} />
          </Field>
          <Field label="What to make" hint="Spell out what “C2 iterations” means: which ad, what to keep, what to change.">
            <textarea
              className={textareaClass}
              value={direction}
              placeholder="e.g. Take C2 (the before/after UGC). Keep the first 3 seconds, make 4 versions with new hooks…"
              onChange={(e) => setDirection(e.target.value)}
            />
          </Field>
          <Field label="Hooks (optional)" hint="One per line.">
            <textarea className={textareaClass} value={hooksText} onChange={(e) => setHooksText(e.target.value)} />
          </Field>
          <Field label="References" hint="One link per line — the ad, a Drive folder, an Ad Library URL. Add a note after the link if it helps: “https://… C2 original”.">
            <textarea
              className={cn(textareaClass, 'font-mono text-xs')}
              value={refsText}
              placeholder="https://…  C2 original"
              onChange={(e) => setRefsText(e.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            size="sm"
            disabled={!briefDirty}
            title={briefDirty ? undefined : 'No changes yet.'}
            onClick={() => {
              const ok = setBrief(task.id, {
                angle,
                direction,
                hooks: hooksText.split('\n'),
                references: parseReferences(refsText),
              })
              if (ok) {
                show({
                  tone: 'success',
                  kind: 'Brief saved',
                  title: `${row.adset.name} · ${row.campaign.name}`,
                  body: 'Yzah sees it on her task now.',
                  ms: 7000,
                })
              }
            }}
          >
            Save brief
          </Button>
        </Section>
      )}

      {!(canBrief && editable) && hooks.length > 0 && (
        <Section title="Hooks" trailing={<CopyButton value={hooks.join('\n')} label="Copy all" />}>
          {hooks.map((h, i) => (
            <TextRow key={i} copy={h}>
              {h}
            </TextRow>
          ))}
        </Section>
      )}

      {!(canBrief && editable) && (
        <Section
          title="Direction"
          trailing={
            batch?.briefUpdatedBy ? (
              <span className="text-xs text-fg-tertiary">
                brief by {userName(db, batch.briefUpdatedBy)}
                {batch.briefUpdatedAt ? ` · ${formatLaunchDate(new Date(batch.briefUpdatedAt))} ${formatTime(batch.briefUpdatedAt)}` : ''}
              </span>
            ) : undefined
          }
        >
          {batch?.angle && (
            <p className="mt-0 mb-3 text-fg-secondary">
              <strong className="text-fg font-medium">Angle:</strong> {batch.angle}
            </p>
          )}
          <Block>{batch?.direction ?? 'No direction supplied.'}</Block>
        </Section>
      )}

      {!(canBrief && editable) && (batch?.references.length ?? 0) > 0 && (
        <Section title="References">
          <ul className="m-0 pl-[18px]">
            {batch!.references.map((r, i) => (
              <li key={i} className="mb-1">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-accent border-b border-accent-border hover:border-accent">
                  {r.label ?? r.url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Only an iteration builds on a source. A fresh batch modelled on the last
          ad set (Next batch) carries lineage for the workspace, not a brief for Yzah. */}
      {row.sourceAdset && iterates && (
        <Section title={row.launch.launchMode === 'DEEP_ITERATION' ? 'Source to iterate from' : 'Source batch to add to'}>
          <Block>
            {[
              `SOURCE CAMPAIGN  ${row.sourceCampaign?.name ?? '—'}`,
              `SOURCE AD SET    ${row.sourceAdset.name}`,
              `SOURCE DRIVE     ${row.sourceBatch?.driveUrl ?? '—'}`,
            ].join('\n')}
          </Block>
          {row.sourceBatch?.driveUrl && (
            <div className="mt-2">
              <LinkButton href={row.sourceBatch.driveUrl}>Open source Drive</LinkButton>
            </div>
          )}
        </Section>
      )}

      <Section
        title={isUpdate ? 'Submission — editable until setup completes' : 'Submission'}
        trailing={
          task.submittedAt ? (
            <span className="text-xs text-fg-tertiary">
              submitted {formatTime(task.submittedAt)}
              {task.submittedBy ? ` by ${userName(db, task.submittedBy)}` : ''}
            </span>
          ) : undefined
        }
      >
        {!canSubmit ? (
          <Block>
            {[
              `STATUS   ${task.status}`,
              `DRIVE    ${batch?.driveUrl ?? 'not submitted'}`,
              task.submittedAt
                ? `SUBMITTED ${formatTime(task.submittedAt)}${task.submittedBy ? ` by ${userName(db, task.submittedBy)}` : ''}`
                : null,
              task.submissionNote ? `NOTE     ${task.submissionNote}` : null,
            ]
              .filter(Boolean)
              .join('\n')}
          </Block>
        ) : (
          <>
            {!editable && (
              <Callout>
                Setup completed this launch — the ads are live, so the submission is locked.
              </Callout>
            )}
            <Field label="Google Drive link">
              <input
                className={inputClass}
                value={drive}
                disabled={!editable}
                placeholder="https://drive.google.com/…"
                onChange={(e) => setDrive(e.target.value)}
              />
            </Field>
            <Field label="Note (optional)">
              <textarea
                className={textareaClass}
                value={note}
                disabled={!editable}
                placeholder="Anything setup should know…"
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {row.setupTask && task.status === 'TODO' && (
              <div className="text-fg-secondary">
                Submitting moves the setup task from <Chip tone="warn">Waiting</Chip> to{' '}
                <Chip tone="success">Ready</Chip> in Karl and Christian&apos;s queue.{' '}
                <SetupStatusChip status={row.setupTask.status} short />
              </div>
            )}
          </>
        )}
      </Section>

      {(isYzah || task.requestNote) && (
        <Section
          title="Request to Charles"
          trailing={task.requestNote ? <RequestChip note={task.requestNote} /> : undefined}
        >
          {isYzah ? (
            <>
              <Field
                label="What do you need?"
                hint="Missing references, wrong product, not enough source files — Charles sees this as a flag on the task."
              >
                <textarea
                  className={textareaClass}
                  value={request}
                  placeholder="e.g. The source Drive only has 3 of the 8 files…"
                  onChange={(e) => setRequestText(e.target.value)}
                />
              </Field>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!request.trim() || request.trim() === task.requestNote}
                  onClick={() => setRequest(task.id, request)}
                >
                  {task.requestNote ? 'Update request' : 'Send request'}
                </Button>
                {task.requestNote && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRequest(task.id, undefined)
                      setRequestText('')
                    }}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Block>{`${userName(db, task.assignee)}  ${task.requestAt ? formatTime(task.requestAt) : ''}\n${task.requestNote}`}</Block>
          )}
        </Section>
      )}
    </Drawer>
  )
}
