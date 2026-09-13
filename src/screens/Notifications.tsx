// Setup-team notifications: a bell with an unread count and feed, and a toast
// when something new lands while the app is open.
//
// The feed is derived from the activity log (see `setupEvents`), so it is the
// same for everyone and survives reloads. What is per viewer is the "seen" line —
// stored per user in localStorage — and the toasts, which only fire for events
// that arrive after the page mounted and were not this viewer's own doing.

import { useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '../components/Toaster'
import { Button, Chip, cn, type ChipTone } from '../components/ui'
import { formatTime } from '../naming'
import { eventKindsFor, setupEvents, type SetupEventKind } from '../selectors'
import { useStore } from '../store'

const SEEN_KEY = (userId: string) => `campaignlauncher.notif.seen.${userId}`
const TOAST_MS = 7000

const KIND_TONE: Record<SetupEventKind, ChipTone> = {
  COMPLETED: 'success',
  BLOCKED: 'danger',
  UNBLOCKED: 'success',
  ACCOUNT: 'warn',
  QA: 'info',
  SUBMITTED: 'success',
  REQUEST: 'warn',
  INSTRUCTIONS: 'accent',
}

const KIND_LABEL: Record<SetupEventKind, string> = {
  COMPLETED: 'Launched',
  BLOCKED: 'Blocked',
  UNBLOCKED: 'Unblocked',
  ACCOUNT: 'Account',
  QA: 'QA',
  SUBMITTED: 'Ready for setup',
  REQUEST: 'Request',
  INSTRUCTIONS: 'Instructions',
}

function readSeen(userId: string): string {
  try {
    return window.localStorage.getItem(SEEN_KEY(userId)) ?? ''
  } catch {
    return ''
  }
}

function writeSeen(userId: string, iso: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY(userId), iso)
  } catch {
    /* private mode */
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? formatTime(iso)
    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${formatTime(iso)}`
}

/** Everything both the bell and the toasts need, computed once per db change. */
function useSetupFeed() {
  const { db, currentUser } = useStore()
  const events = useMemo(() => {
    const allowed = eventKindsFor(currentUser.role)
    return setupEvents(db).filter((e) => allowed.has(e.kind))
  }, [db, currentUser.role])
  const [seenAt, setSeenAt] = useState(() => readSeen(currentUser.id))

  // Switching seats switches the seen line.
  useEffect(() => setSeenAt(readSeen(currentUser.id)), [currentUser.id])

  const unread = events.filter((e) => e.at > seenAt && e.actorId !== currentUser.id)
  const markAllRead = () => {
    const now = new Date().toISOString()
    writeSeen(currentUser.id, now)
    setSeenAt(now)
  }
  return { events, unread, markAllRead, seenAt }
}

// ------------------------------------------------------------------- bell

export function NotificationBell({ onOpenAdset }: { onOpenAdset: (adsetId: string) => void }) {
  const { events, unread, markAllRead, seenAt } = useSetupFeed()
  const { currentUser } = useStore()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        aria-label={unread.length ? `${unread.length} new setup notifications` : 'Setup notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Team activity"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
          open ? 'border-line-strong bg-surface-hover text-fg' : 'border-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg',
        )}
      >
        <span aria-hidden="true" className="text-[15px] leading-none">
          ◔
        </span>
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-accent-fg text-[10px] font-semibold leading-4 text-center tabular-nums">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Team activity"
          className="fixed right-3 top-12 z-40 w-[380px] max-w-[calc(100vw-24px)] border border-line-strong rounded-xl bg-surface-raised shadow-menu animate-pop overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
            <span className="font-medium">Activity</span>
            {unread.length > 0 && <Chip tone="accent">{unread.length} new</Chip>}
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={markAllRead} disabled={unread.length === 0}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {events.length === 0 ? (
              <p className="m-0 px-3 py-6 text-center text-xs text-fg-tertiary">
                Nothing yet.
              </p>
            ) : (
              events.slice(0, 30).map((e) => {
                const isNew = e.at > seenAt && e.actorId !== currentUser.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={!e.adsetId}
                    onClick={() => {
                      if (e.adsetId) {
                        onOpenAdset(e.adsetId)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-left border-b border-line last:border-b-0 transition-colors',
                      e.adsetId ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default',
                      isNew && 'bg-accent-bg/30',
                    )}
                  >
                    <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', isNew ? 'bg-accent' : 'bg-transparent')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] leading-snug">{e.text}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-tertiary">
                        <Chip tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Chip>
                        {dayLabel(e.at)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ toasts

/**
 * Pushes a toast for each setup event that arrives after mount and was not done
 * by this viewer. Events already in the log at mount are the bell's business;
 * the viewer's own actions get their confirmation from the screen that ran them.
 */
export function SetupToasts({ onOpenAdset }: { onOpenAdset: (adsetId: string) => void }) {
  const { db, currentUser } = useStore()
  const { show } = useToast()
  const events = useMemo(() => {
    const allowed = eventKindsFor(currentUser.role)
    return setupEvents(db, 20).filter((e) => allowed.has(e.kind))
  }, [db, currentUser.role])
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(events.map((e) => e.id))
      return
    }
    const fresh = events.filter((e) => !known.current!.has(e.id) && e.actorId !== currentUser.id)
    for (const e of events) known.current.add(e.id)
    for (const e of fresh.reverse()) {
      show({
        tone: KIND_TONE[e.kind],
        kind: KIND_LABEL[e.kind],
        title: e.text,
        action: e.adsetId ? { label: 'Open', onClick: () => onOpenAdset(e.adsetId!) } : undefined,
        ms: TOAST_MS,
      })
    }
  }, [events, currentUser.id, show, onOpenAdset])

  return null
}
