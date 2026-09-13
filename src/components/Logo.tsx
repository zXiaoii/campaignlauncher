// The mark: an up-and-right arrow with a launch trail, in an accent tile. Drawn
// on a 32-unit grid so it stays crisp at 16px (favicon) and 28px (header).
// `public/favicon.svg` is the same drawing with the colours hard-coded.

export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Campaign Launcher"
      className={className}
    >
      <defs>
        <linearGradient id="cl-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-hover)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#cl-tile)" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="none" stroke="rgba(255,255,255,0.18)" />
      {/* trail */}
      <path d="M8 24.5 L14 18.5" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 19 L10 16" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
      {/* arrow */}
      <path d="M12.5 19.5 L23 9" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M15.5 9 H23 V16.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-[-0.025em] whitespace-nowrap">
      <LogoMark size={size} />
      Campaign Launcher
    </span>
  )
}
