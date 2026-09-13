// One toast stack for the whole app. Two things use it: confirmations of the
// viewer's own action ("✓ Launched …"), and live notifications of other people's
// actions. Same place on screen, same shape, so nobody learns two systems.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Button, Chip, cn, type ChipTone } from './ui'

export interface ToastInput {
  tone: ChipTone
  /** Short label in the chip: "Launched", "Blocked", "Submitted"… */
  kind: string
  /** The headline — the exact names, so the person can check it against Meta. */
  title: string
  /** One more line: what happens next, who was told. */
  body?: string
  action?: { label: string; onClick: () => void }
  /** Milliseconds on screen. Confirmations stay longer than passing notices. */
  ms?: number
}

interface Toast extends ToastInput {
  id: number
  ms: number
}

interface ToasterValue {
  show: (t: ToastInput) => void
}

const ToasterContext = createContext<ToasterValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current
      const ms = t.ms ?? 7000
      setToasts((list) => [{ ...t, id, ms }, ...list].slice(0, 4))
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToasterContext.Provider>
  )
}

export function useToast(): ToasterValue {
  const ctx = useContext(ToasterContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  // Escape clears the newest toast — the one most likely covering something.
  useEffect(() => {
    if (toasts.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss(toasts[0].id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toasts, onDismiss])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed right-4 bottom-4 z-[70] flex flex-col gap-2 w-[400px] max-w-[calc(100vw-32px)]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'flex items-start gap-3 px-3.5 py-3 border rounded-xl bg-surface-raised shadow-menu animate-pop',
            t.tone === 'success' && 'border-success-border',
            t.tone === 'danger' && 'border-danger-border',
            t.tone === 'warn' && 'border-warn-border',
            t.tone === 'info' && 'border-info-border',
            !['success', 'danger', 'warn', 'info'].includes(t.tone) && 'border-line-strong',
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold shrink-0',
              t.tone === 'success' && 'bg-success-bg text-success',
              t.tone === 'danger' && 'bg-danger-bg text-danger',
              t.tone === 'warn' && 'bg-warn-bg text-warn',
              t.tone === 'info' && 'bg-info-bg text-info',
              !['success', 'danger', 'warn', 'info'].includes(t.tone) && 'bg-bg-subtle-2 text-fg-secondary',
            )}
            aria-hidden="true"
          >
            {t.tone === 'success' ? '✓' : t.tone === 'danger' ? '!' : t.tone === 'warn' ? '!' : '•'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Chip tone={t.tone}>{t.kind}</Chip>
            </div>
            <div className="text-[13px] font-medium leading-snug break-words">{t.title}</div>
            {t.body && <div className="mt-0.5 text-xs text-fg-secondary leading-snug">{t.body}</div>}
            {t.action && (
              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    t.action!.onClick()
                    onDismiss(t.id)
                  }}
                >
                  {t.action.label}
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="text-fg-tertiary hover:text-fg shrink-0"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
