// Core components from PRD §3.3, styled with Tailwind utilities. The design
// tokens live in index.css; nothing here names a colour directly.
//
// Repeated recipes (buttons, inputs, table cells) are components or exported
// class strings rather than CSS classes, so a screen can read every style it
// uses without leaving the file.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ------------------------------------------------------------ class recipes

export const mono = 'font-mono text-xs tracking-[-0.01em]'

export const labelClass =
  'block mb-1.5 text-[11px] font-medium tracking-[0.045em] uppercase text-fg-secondary'

export const hintClass = 'mt-1.5 text-xs text-fg-tertiary'

const fieldBase =
  'w-full bg-bg-subtle border border-line-strong rounded-lg outline-none transition-colors duration-150 hover:border-line-focus focus:border-fg-secondary focus:bg-surface placeholder:text-fg-tertiary'

export const inputClass = cn(fieldBase, 'h-[34px] px-2.5')
export const selectClass = cn(fieldBase, 'h-[34px] px-2.5 select-caret')
export const textareaClass = cn(fieldBase, 'min-h-20 px-2.5 py-2 resize-y leading-relaxed')

/** Monospace readout block — the PRD's ASCII-ish structure panels. */
export const blockClass =
  'm-0 px-3 py-[11px] border border-line rounded-lg bg-bg font-mono text-xs leading-[1.65] whitespace-pre-wrap break-words text-fg-secondary'

export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <pre className={cn(blockClass, className)}>{children}</pre>
}

// ------------------------------------------------------------------ button

type Variant = 'default' | 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border transition-[background-color,border-color,transform,opacity] duration-150 enabled:active:scale-[0.985] disabled:cursor-not-allowed'

const BUTTON_VARIANT: Record<Variant, string> = {
  default:
    'bg-surface-raised border-line-strong text-fg shadow-highlight enabled:hover:bg-surface-hover enabled:hover:border-line-focus disabled:text-fg-tertiary disabled:border-line disabled:bg-bg-subtle disabled:shadow-none',
  primary:
    'bg-accent border-accent text-accent-fg font-medium enabled:hover:bg-accent-hover enabled:hover:border-accent-hover disabled:bg-bg-subtle-2 disabled:border-line disabled:text-fg-tertiary',
  ghost:
    'bg-transparent border-transparent text-fg-secondary enabled:hover:bg-surface-hover enabled:hover:border-line enabled:hover:text-fg disabled:text-fg-tertiary',
  danger:
    'bg-surface-raised border-danger-border text-danger enabled:hover:bg-danger-bg enabled:hover:border-danger disabled:text-fg-tertiary',
}

const BUTTON_SIZE: Record<Size, string> = {
  md: 'h-[34px] px-3 rounded-lg text-[13px]',
  sm: 'h-7 px-[9px] rounded-md text-xs',
}

export function buttonClass(
  variant: Variant = 'default',
  size: Size = 'md',
  extra?: string,
): string {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], extra)
}

export function Button({
  variant = 'default',
  size = 'md',
  block,
  icon,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: boolean
}) {
  return (
    <button
      type={type}
      className={buttonClass(
        variant,
        size,
        cn(block && 'w-full', icon && 'w-7 px-0', className),
      )}
      {...rest}
    />
  )
}

/** An anchor that looks like a button — external links (Drive, references). */
export function LinkButton({
  href,
  children,
  size = 'sm',
  className,
}: {
  href: string
  children: ReactNode
  size?: Size
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonClass('default', size, cn('no-underline', className))}
    >
      {children}
    </a>
  )
}

// --------------------------------------------------------------------- chip

const CHIP_TONE = {
  default: 'bg-bg-subtle-2 border-line text-fg-secondary',
  solid: 'bg-fg border-fg text-bg',
  accent: 'bg-accent-bg border-accent-border text-accent',
  info: 'bg-info-bg border-info-border text-info',
  violet: 'bg-violet-bg border-violet-border text-violet',
  rose: 'bg-rose-bg border-rose-border text-rose',
  warn: 'bg-warn-bg border-warn-border text-warn',
  success: 'bg-success-bg border-success-border text-success',
  danger: 'bg-danger-bg border-danger-border text-danger',
  quiet: 'bg-transparent border-line text-fg-secondary',
} as const

export type ChipTone = keyof typeof CHIP_TONE

/** Text-colour class for a tone — for numbers and words, not chips. */
export const TONE_TEXT: Record<ChipTone, string> = {
  default: 'text-fg',
  solid: 'text-fg',
  accent: 'text-accent',
  info: 'text-info',
  violet: 'text-violet',
  rose: 'text-rose',
  warn: 'text-warn',
  success: 'text-success',
  danger: 'text-danger',
  quiet: 'text-fg-secondary',
}

export function Chip({
  children,
  tone = 'default',
  title,
  className,
}: {
  children: ReactNode
  tone?: ChipTone
  title?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-5 px-[7px] border rounded-[5px] text-[11px] font-medium whitespace-nowrap',
        CHIP_TONE[tone],
        className,
      )}
      title={title}
    >
      {children}
    </span>
  )
}

// -------------------------------------------------------------- copy button

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** §15.2 — brief inline "Copied" feedback, never a toast per copy. */
export function CopyButton({
  value,
  label = 'Copy',
  variant = 'default',
  size = 'sm',
  block,
}: {
  value: string
  label?: string
  variant?: Variant
  size?: Size
  block?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <Button
      variant={variant}
      size={size}
      block={block}
      onClick={async (e) => {
        e.stopPropagation()
        const ok = await writeClipboard(value)
        setCopied(ok)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1400)
      }}
      aria-label={`${label} ${value}`}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

/** The copy-first row used all over the setup drawer (§10.3). */
export function CopyRow({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-center gap-2 px-[11px] py-2.5 mb-2 border border-line rounded-lg bg-surface">
      <div className="min-w-0 font-mono text-[12.5px] break-all">
        <span className="block mb-[3px] font-sans text-[10.5px] font-medium tracking-[0.055em] uppercase text-fg-tertiary">
          {label}
        </span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="border-b border-line-strong hover:border-fg">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
      <div className="ml-auto flex gap-1.5 shrink-0">
        {href && <LinkButton href={href}>Open</LinkButton>}
        <CopyButton value={value} />
      </div>
    </div>
  )
}

/** A hook / note row: plain text with its own copy button. */
export function TextRow({ children, copy }: { children: ReactNode; copy: string }) {
  return (
    <div className="flex items-center gap-2 px-[11px] py-2.5 mb-2 border border-line rounded-lg bg-surface">
      <div className="min-w-0 text-[13px]">{children}</div>
      <div className="ml-auto shrink-0">
        <CopyButton value={copy} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- QA check

/**
 * Mark's QA checkmark (§11.2). Non-blocking by design — it is a record that setup
 * was eyeballed, never a gate. Rendered disabled (but still legible) for everyone
 * who can see it but not set it.
 */
export function CheckButton({
  checked,
  onToggle,
  disabled,
  title,
  showLabel,
}: {
  checked: boolean
  onToggle?: () => void
  disabled?: boolean
  title?: string
  showLabel?: boolean
}) {
  const inert = disabled || !onToggle
  return (
    <button
      type="button"
      disabled={inert}
      aria-pressed={checked}
      aria-label={checked ? 'QA checked — click to clear' : 'Mark QA checked'}
      title={title ?? (checked ? 'QA checked' : 'Not checked')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle?.()
      }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-6 min-w-6 px-[7px] rounded-md border text-xs transition-colors duration-150',
        checked
          ? 'bg-success-bg border-success-border text-success'
          : 'bg-bg-subtle-2 border-line text-fg-tertiary',
        inert ? 'cursor-default' : 'cursor-pointer hover:border-line-focus hover:text-fg-secondary',
        inert && !checked && 'opacity-35',
      )}
    >
      <span className="text-[11px] leading-none" aria-hidden="true">
        {checked ? '✓' : '○'}
      </span>
      {showLabel && (checked ? 'Checked' : 'Mark checked')}
    </button>
  )
}

// ------------------------------------------------------------------- drawer

/** §3.1 — right-side drawer is the main create/edit/detail pattern. */
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px] animate-fade"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[41] flex flex-col bg-bg-subtle border-l border-line-strong shadow-drawer animate-slide',
          wide ? 'w-[min(780px,100vw)]' : 'w-[min(620px,100vw)]',
        )}
      >
        <div className="flex items-start gap-3 px-4 py-[15px] border-b border-line glass">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h2>
            {subtitle && <div className="mt-[3px] text-fg-secondary">{subtitle}</div>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto" aria-label="Close">
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-line bg-bg-subtle-2">
            {footer}
          </div>
        )}
      </aside>
    </>
  )
}

// ------------------------------------------------------------------ sections

export function Section({
  n,
  title,
  trailing,
  children,
}: {
  n?: number
  title: string
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="pb-[18px] mb-[18px] border-b border-line last:pb-0 last:mb-0 last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        {n !== undefined && (
          <span className="inline-flex items-center justify-center w-[19px] h-[19px] rounded-full border border-line-strong text-[10px] font-semibold text-fg-secondary shrink-0">
            {n}
          </span>
        )}
        <h3 className="text-[13px] font-semibold tracking-[-0.01em]">{title}</h3>
        {trailing && (
          <>
            <span className="flex-1" />
            {trailing}
          </>
        )}
      </div>
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block mb-3.5">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className={cn(hintClass, 'block')}>{hint}</span>}
    </label>
  )
}

/** Page header — title + one-line purpose, with optional right-side content. */
export function PageHead({
  title,
  sub,
  children,
}: {
  title: ReactNode
  sub?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex items-start gap-4 flex-wrap mb-3.5">
      <div>
        <h1 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]">{title}</h1>
        {sub && <div className="mt-0.5 text-xs text-fg-secondary max-w-[80ch]">{sub}</div>}
      </div>
      {children && (
        <>
          <span className="flex-1" />
          {children}
        </>
      )}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap mb-3">{children}</div>
}

// ------------------------------------------------------------ option / radio

export interface OptionItem<T extends string> {
  value: T
  title: string
  desc?: ReactNode
  note?: ReactNode
  disabled?: boolean
  disabledReason?: string
}

export function OptionList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined
  options: OptionItem<T>[]
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <div className="grid gap-1.5">
      {options.map((o) => {
        const selected = value === o.value
        return (
          <label
            key={o.value}
            title={o.disabled ? o.disabledReason : undefined}
            className={cn(
              'flex items-start gap-[9px] px-[11px] py-2.5 border rounded-lg transition-colors duration-150',
              selected
                ? 'border-accent-border bg-accent-bg/60 shadow-highlight'
                : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover',
              o.disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-[3px] shrink-0 accent-accent"
            />
            <span className="min-w-0">
              <span className="font-medium">{o.title}</span>
              {o.desc && (
                <>
                  <br />
                  <span className="text-xs text-fg-secondary">{o.desc}</span>
                </>
              )}
            </span>
            {o.note && <span className="ml-auto pl-2 shrink-0">{o.note}</span>}
          </label>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------- segmented

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex p-[3px] bg-bg-subtle border border-line rounded-lg"
    >
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-[26px] px-[11px] rounded-md whitespace-nowrap transition-colors duration-150',
              on
                ? 'bg-surface-raised text-accent font-medium shadow-seg'
                : 'text-fg-secondary hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------ overflow menu

export interface MenuEntry {
  label: string
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
  separatorBefore?: boolean
  /** Destructive — rendered in the danger colour. */
  danger?: boolean
}

/** §3.3 — the ••• menu for secondary actions. */
export function OverflowMenu({
  entries,
  label = '•••',
}: {
  entries: MenuEntry[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Rendered into <body> with fixed coordinates so no card, section or table
  // with overflow clipping can cut it off; flips above the button when the
  // viewport has no room below.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onMove = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  const place = () => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const estimated = entries.length * 30 + 10 + entries.filter((e) => e.separatorBefore).length * 11
    const spaceBelow = window.innerHeight - r.bottom - 8
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(
      spaceBelow >= estimated || spaceBelow >= r.top
        ? { top: r.bottom + 5, right }
        : { bottom: window.innerHeight - r.top + 5, right },
    )
  }

  return (
    <div className="relative" ref={wrap}>
      <Button
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={(e) => {
          e.stopPropagation()
          if (!open) place()
          setOpen((o) => !o)
        }}
      >
        {label}
      </Button>
      {open &&
        pos &&
        createPortal(
        <div
          ref={menu}
          role="menu"
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, right: pos.right }}
          className="z-[70] min-w-[214px] p-[5px] bg-surface-raised border border-line-strong rounded-lg shadow-menu animate-pop"
        >
          {entries.map((entry, i) => (
            <div key={`${entry.label}-${i}`}>
              {entry.separatorBefore && <div className="h-px my-[5px] bg-line" />}
              <button
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                title={entry.disabled ? entry.disabledReason : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  entry.onClick?.()
                }}
                className={cn(
                  'block w-full h-[30px] px-[9px] rounded-md text-left transition-colors enabled:hover:bg-surface-hover disabled:text-fg-tertiary disabled:cursor-not-allowed',
                  entry.danger ? 'text-danger enabled:hover:bg-danger-bg' : 'text-fg',
                )}
              >
                {entry.label}
              </button>
            </div>
          ))}
        </div>,
          document.body,
        )}
    </div>
  )
}

// ---------------------------------------------------------------- misc bits

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-11 border border-dashed border-line-strong rounded-xl bg-bg-subtle text-center text-fg-secondary">
      <strong className="block mb-1 text-fg font-medium">{title}</strong>
      {hint}
    </div>
  )
}

export function Callout({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: 'default' | 'danger'
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-[13px] py-[11px] border border-l-2 rounded-r-lg mb-4 [&_strong]:font-medium',
        tone === 'danger'
          ? 'border-danger-border border-l-danger bg-danger-bg text-fg'
          : 'border-line border-l-fg-secondary bg-bg-subtle text-fg-secondary [&_strong]:text-fg',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** One-line counter strip — number and label side by side, not stacked tiles. */
export function Stats({
  items,
}: {
  items: { k: string; v: ReactNode; tone?: ChipTone; danger?: boolean; success?: boolean }[]
}) {
  return (
    <div className="inline-flex flex-wrap mb-3 border border-line rounded-lg overflow-hidden bg-surface shadow-highlight">
      {items.map((it) => (
        <div
          key={it.k}
          className="flex items-baseline gap-1.5 px-3 py-1.5 border-r border-line last:border-r-0"
        >
          <span
            className={cn(
              'text-base font-semibold tracking-[-0.02em] tabular-nums',
              it.tone ? TONE_TEXT[it.tone] : 'text-fg',
              it.danger && 'text-danger',
              it.success && 'text-success',
            )}
          >
            {it.v}
          </span>
          <span className="text-[11px] tracking-[0.04em] uppercase text-fg-secondary whitespace-nowrap">
            {it.k}
          </span>
        </div>
      ))}
    </div>
  )
}

// -------------------------------------------------------------------- table

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border border-line rounded-xl overflow-auto bg-surface shadow-highlight max-h-[calc(100vh-250px)]',
        className,
      )}
    >
      <table className="w-full border-separate border-spacing-0 [&_tbody_tr:last-child_td]:border-b-0">
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  className,
  title,
}: {
  children?: ReactNode
  className?: string
  title?: string
}) {
  return (
    <th
      title={title}
      className={cn(
        'sticky top-0 z-[2] h-[30px] px-2.5 bg-bg-subtle-2 border-b border-line text-left text-[11px] font-medium tracking-[0.045em] uppercase text-fg-secondary whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  title,
  onClick,
  late,
}: {
  children?: ReactNode
  className?: string
  title?: string
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
  late?: boolean
}) {
  return (
    <td
      title={title}
      onClick={onClick}
      className={cn(
        'h-10 px-2.5 border-b border-line align-middle max-w-[260px]',
        late && 'late-bar',
        className,
      )}
    >
      {children}
    </td>
  )
}

/** Two-line cell: a primary value with a small secondary under it. Saves a column. */
export function StackedTd({
  primary,
  secondary,
  className,
  late,
}: {
  primary: ReactNode
  secondary?: ReactNode
  className?: string
  late?: boolean
}) {
  return (
    <Td className={cn('whitespace-nowrap', className)} late={late}>
      <div className="leading-tight">{primary}</div>
      {secondary && <div className="text-[11px] leading-tight text-fg-tertiary">{secondary}</div>}
    </Td>
  )
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(onClick && 'cursor-pointer transition-colors hover:bg-surface-hover', className)}
    >
      {children}
    </tr>
  )
}

/** Truncating monospace cell for exact names — full text lives in `title`. */
export function NameTd({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Td className={cn(mono, 'truncate', muted && 'text-fg-secondary')} title={value}>
      {value}
    </Td>
  )
}
