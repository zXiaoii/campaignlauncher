// The first and only thing an unauthenticated visitor sees.

import { useState, type FormEvent } from 'react'

import { LogoMark } from '../components/Logo'
import { Button, cn, inputClass, labelClass } from '../components/ui'
import { verify } from '../auth'
import { backendLabel } from '../firebase/env'

export function SignIn({ onSignedIn }: { onSignedIn: (userId: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    let userId: string | null = null
    try {
      userId = await verify(username, password)
    } catch (e: unknown) {
      // A setup problem (auth not enabled, wrong domain…) is not the user's
      // fault — say exactly what it is rather than "wrong password".
      setBusy(false)
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    setBusy(false)
    if (!userId) {
      setError('Wrong username or password.')
      setPassword('')
      return
    }
    onSignedIn(userId)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <form
        onSubmit={submit}
        className="w-full max-w-[360px] p-6 border border-line rounded-2xl bg-surface shadow-highlight"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <LogoMark size={32} />
          <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Campaign Launcher</h1>
        </div>
        <p className="mb-5 text-xs text-fg-secondary">Sign in with the username and password you were given.</p>

        <label className="block mb-3.5">
          <span className={labelClass}>Username</span>
          <input
            className={inputClass}
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="block mb-4">
          <span className={labelClass}>Password</span>
          <input
            className={inputClass}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <div role="alert" className="mb-4 px-3 py-2 border border-danger-border rounded-lg bg-danger-bg text-xs text-fg">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          block
          disabled={busy || !username.trim() || !password}
          className={cn(busy && 'opacity-70')}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="mt-4 mb-0 text-center text-[11px] text-fg-tertiary">{backendLabel()}</p>
      </form>
    </div>
  )
}
