import { useEffect, useState } from 'react'

import { Logo } from './components/Logo'
import { ToastProvider } from './components/Toaster'
import { Button, cn } from './components/ui'
import { NAV } from './permissions'
import { StoreProvider, useStore } from './store'
import { useTheme } from './theme'
import { AdAccounts } from './screens/AdAccounts'
import { AdsetDrawer } from './screens/AdsetDrawer'
import { CreativeTasks } from './screens/CreativeTasks'
import { Dashboard } from './screens/Dashboard'
import { DayView } from './screens/DayView'
import { Followups } from './screens/Followups'
import { LaunchDrawer, type LaunchIntent } from './screens/LaunchDrawer'
import { Library } from './screens/Library'
import { NotificationBell, SetupToasts } from './screens/Notifications'
import { SetupOverview } from './screens/SetupOverview'
import { SetupTasks } from './screens/SetupTasks'
import { Team } from './screens/Team'
import { Workspace } from './screens/Workspace'

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  )
}

function Shell() {
  const { currentUser, signOut, error, clearError, reset } = useStore()
  const { theme, toggle } = useTheme()
  const nav = NAV[currentUser.role]
  const [requested, setActive] = useState(nav[0].key)
  const [intent, setIntent] = useState<LaunchIntent | null>(null)
  const [adsetId, setAdsetId] = useState<string | null>(null)

  // Derived, not synced: a screen the new role has no route to falls back to that
  // role's home immediately, with no frame of the previous role's screen showing.
  const active = nav.some((n) => n.key === requested) ? requested : nav[0].key

  // Anything open belongs to the previous seat.
  useEffect(() => {
    setIntent(null)
    setAdsetId(null)
  }, [currentUser.role])

  const isCharles = currentUser.role === 'MEDIA_BUYER'
  const openLaunch = isCharles ? (i: LaunchIntent) => setIntent(i) : undefined
  const drawerOpen = Boolean(intent || adsetId)

  return (
    <div className="flex flex-col min-h-full">
      {/* One row, always. Nav scrolls horizontally rather than wrapping. */}
      <header className="sticky top-0 z-30 flex items-center gap-4 h-11 px-4 border-b border-line glass">
        <Logo size={24} />
        <nav
          className="flex items-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none]"
          aria-label="Main"
        >
          {nav.map((item) => {
            const on = active === item.key
            return (
              <button
                key={item.key}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => setActive(item.key)}
                className={cn(
                  'relative h-11 px-2.5 whitespace-nowrap text-[13px] transition-colors',
                  on ? 'text-fg font-medium' : 'text-fg-secondary hover:text-fg',
                  on &&
                    'after:content-[""] after:absolute after:left-2.5 after:right-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <NotificationBell onOpenAdset={setAdsetId} />
          <span className="text-xs text-fg-secondary whitespace-nowrap">
            {currentUser.name}
            <span className="hidden sm:inline text-fg-tertiary">
              {' · '}
              {currentUser.role.replace('_', ' ').toLowerCase()}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
            Sign out
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? '☾' : '☀'}
          </Button>
          {isCharles && (
            <Button
              variant="ghost"
              size="sm"
              icon
              aria-label="Reset local database"
              title="Reset local database to the seeded day"
              onClick={() => {
                if (
                  window.confirm(
                    'Wipe the local database and rewrite the seeded day? Everything created since then is lost.',
                  )
                ) {
                  reset()
                }
              }}
            >
              ↺
            </Button>
          )}
          {isCharles && (
            <Button variant="primary" size="sm" onClick={() => setIntent({})}>
              + Launch
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] min-w-0 mx-auto px-4 pt-4 pb-10 max-[900px]:px-3">
        {active === 'workspace' && (
          <Workspace
            title="Workspace"
            sub="Country → ad account → CBO. A CBO holds a maximum of four ad sets."
            onLaunch={openLaunch}
            onOpenAdset={setAdsetId}
          />
        )}
        {active === 'countries' && (
          <Workspace
            title="Countries"
            sub="The same campaign structure Charles sees, read-only."
            readOnly
            onOpenAdset={setAdsetId}
          />
        )}
        {active === 'launches' && (
          <DayView
            title="Launches"
            subtitle="What went live each day, grouped by ad account and campaign."
            onOpenAdset={setAdsetId}
            showInFlight={isCharles}
          />
        )}
        {active === 'overview' && <Dashboard onOpenAdset={setAdsetId} />}
        {active === 'creative' && <CreativeTasks />}
        {active === 'setup' && <SetupTasks />}
        {active === 'accounts' && <AdAccounts onOpenAdset={setAdsetId} />}
        {active === 'library' && <Library onLaunch={openLaunch} onOpenAdset={setAdsetId} />}
        {active === 'followups' && openLaunch && (
          <Followups onLaunch={openLaunch} onOpenLibrary={() => setActive('library')} />
        )}
        {active === 'team' && <Team />}
        {active === 'setupOverview' && <SetupOverview mode="overview" />}
        {active === 'setupHistory' && <SetupOverview mode="history" />}
      </main>

      {error && !drawerOpen && (
        <div
          role="alert"
          onClick={clearError}
          className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[60] max-w-[min(560px,calc(100vw-40px))] px-3.5 py-2.5 rounded-lg border border-danger-border bg-danger-bg text-fg shadow-menu cursor-pointer animate-fade"
        >
          {error} <span className="text-fg-tertiary">— click to dismiss</span>
        </div>
      )}

      {adsetId && (
        <AdsetDrawer
          adsetId={adsetId}
          onClose={() => setAdsetId(null)}
          onLaunch={
            openLaunch
              ? (i) => {
                  setAdsetId(null)
                  setIntent(i)
                }
              : undefined
          }
        />
      )}

      {intent && <LaunchDrawer intent={intent} onClose={() => setIntent(null)} />}

      <SetupToasts onOpenAdset={setAdsetId} />
    </div>
  )
}
