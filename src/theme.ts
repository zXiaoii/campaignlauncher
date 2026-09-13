// Theme. Dark is the default; the PRD's original light palette is still available.
// The stored value is also read by an inline script in index.html so the first
// paint is already correct — no flash of the wrong theme on reload.

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export const THEME_KEY = 'launchdesk.theme'

export function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode — the theme just won't persist */
    }
  }, [theme])

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )

  return { theme, toggle }
}
