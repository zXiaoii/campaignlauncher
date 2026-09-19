// Team — who is on it and in which seat. Charles adds people and switches them
// off; Danny can look. Nobody is ever deleted: an inactive person cannot sign in,
// but their name stays on every launch, blocker and check they touched.

import { useState } from 'react'

import { createAccount } from '../auth'
import { useToast } from '../components/Toaster'
import {
  Button,
  Callout,
  Chip,
  cn,
  Drawer,
  Field,
  inputClass,
  mono,
  PageHead,
  Section,
  selectClass,
  TableWrap,
  Td,
  Th,
  Toolbar,
  Tr,
  type ChipTone,
} from '../components/ui'
import { isFirebaseConfigured } from '../firebase/env'
import { useActions, useStore } from '../store'
import type { Role } from '../types'

const ROLE_LABEL: Record<Role, string> = {
  MEDIA_BUYER: 'Media buyer',
  CEO: 'Executive',
  CREATIVE: 'Creative',
  SETUP: 'Setup',
  SETUP_QA: 'Setup QA',
  STORE: 'Funnels & store',
}

const ROLE_TONE: Record<Role, ChipTone> = {
  MEDIA_BUYER: 'accent',
  CEO: 'quiet',
  CREATIVE: 'rose',
  SETUP: 'success',
  SETUP_QA: 'info',
  STORE: 'violet',
}

const ROLE_DESC: Record<Role, string> = {
  MEDIA_BUYER: 'Plans and launches. Full control, including this screen.',
  CEO: 'Sees everything, changes nothing.',
  CREATIVE: 'Creative task queue: briefs in, Drive links out.',
  SETUP: 'Setup task queue: exact names in, launches out. Can raise blockers and report account problems.',
  SETUP_QA: 'Setup oversight and the QA checkmark. Never sees the creative queue.',
  STORE: 'Funnelish and Shopify. Sees one screen: which products are live in which market, with a tick for each.',
}

const ROLES: Role[] = ['SETUP', 'CREATIVE', 'SETUP_QA', 'STORE', 'MEDIA_BUYER', 'CEO']

export function Team() {
  const { db, currentUser } = useStore()
  const { setUserActive } = useActions()
  const { show } = useToast()
  const [adding, setAdding] = useState(false)
  const canEdit = currentUser.role === 'MEDIA_BUYER'

  const users = [...db.users].sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder)
  const active = users.filter((u) => u.active)
  const byRole = (r: Role) => active.filter((u) => u.role === r).length

  return (
    <>
      <PageHead
        title={
          <>
            Team <Chip tone="accent">{active.length} active</Chip>
          </>
        }
        sub={`${byRole('SETUP')} setup · ${byRole('CREATIVE')} creative · ${byRole('SETUP_QA')} QA · ${byRole('MEDIA_BUYER')} media buyer · ${byRole('CEO')} executive. Deactivated people keep their name on everything they did.`}
      >
        {canEdit && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            + Add person
          </Button>
        )}
      </PageHead>

      <Toolbar>
        <span className="text-xs text-fg-tertiary">
          {isFirebaseConfigured()
            ? 'Accounts are created in Firebase Auth the moment you add someone.'
            : 'Local database: passwords are hashed and stored in this browser.'}
        </span>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Username</Th>
            <Th>Status</Th>
            {canEdit && <Th className="text-right">Action</Th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const me = u.id === currentUser.id
            return (
              <Tr key={u.id}>
                <Td className={cn('whitespace-nowrap font-medium', !u.active && 'text-fg-tertiary')}>
                  {u.name}
                  {me && <span className="ml-1.5 text-xs text-fg-tertiary">(you)</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  <Chip tone={u.active ? ROLE_TONE[u.role] : 'quiet'}>{ROLE_LABEL[u.role]}</Chip>
                </Td>
                <Td className={cn(mono, 'whitespace-nowrap', !u.active && 'text-fg-tertiary')}>{u.username}</Td>
                <Td className="whitespace-nowrap">
                  {u.active ? <Chip tone="success">● Active</Chip> : <Chip tone="quiet">⊘ Deactivated</Chip>}
                </Td>
                {canEdit && (
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant={u.active ? 'ghost' : 'default'}
                      disabled={me}
                      title={me ? 'You cannot deactivate yourself.' : undefined}
                      onClick={() => {
                        if (
                          u.active &&
                          !window.confirm(`Deactivate ${u.name}? They will not be able to sign in. Their history stays.`)
                        ) {
                          return
                        }
                        if (setUserActive(u.id, !u.active)) {
                          show({
                            tone: u.active ? 'default' : 'success',
                            kind: u.active ? 'Deactivated' : 'Reactivated',
                            title: u.name,
                            body: u.active ? 'Cannot sign in from now on.' : 'Can sign in again.',
                          })
                        }
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </Td>
                )}
              </Tr>
            )
          })}
        </tbody>
      </TableWrap>

      {adding && <AddPersonDrawer onClose={() => setAdding(false)} />}
    </>
  )
}

function AddPersonDrawer({ onClose }: { onClose: () => void }) {
  const { db, error, clearError } = useStore()
  const { createUser } = useActions()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>('SETUP')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const cleanUsername = username.trim().toLowerCase()
  const usernameTaken = db.users.some((u) => u.username === cleanUsername)
  const usernameValid = /^[a-z0-9._-]{2,32}$/.test(cleanUsername)
  const canCreate = name.trim().length > 0 && usernameValid && !usernameTaken && password.length >= 6 && !busy

  async function submit() {
    if (!canCreate) return
    setBusy(true)
    setAuthError(null)
    try {
      // Auth first, then the record: a failed account creation must not leave a
      // person in the team who cannot sign in.
      const { passwordHash } = await createAccount(cleanUsername, password)
      if (createUser({ name: name.trim(), username: cleanUsername, role, passwordHash })) {
        show({
          tone: 'success',
          kind: 'Added',
          title: `${name.trim()} · ${ROLE_LABEL[role]}`,
          body: `Username ${cleanUsername}. Give them the password you just set — it is not shown again.`,
          ms: 10000,
        })
        onClose()
      }
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      title="Add a person"
      subtitle="They can sign in as soon as you save."
      onClose={onClose}
      footer={
        <>
          <span className="text-xs text-fg-tertiary">
            Username and password are what they type on the sign-in card.
          </span>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canCreate} onClick={submit}>
            {busy ? 'Adding…' : 'Add to team'}
          </Button>
        </>
      }
    >
      {(error || authError) && (
        <Callout tone="danger">
          {authError ?? error}{' '}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAuthError(null)
              clearError()
            }}
          >
            Dismiss
          </Button>
        </Callout>
      )}

      <Section title="Who">
        <Field label="Name" hint="As it should appear on tasks and notifications.">
          <input className={inputClass} value={name} autoFocus placeholder="e.g. Maria" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role" hint={ROLE_DESC[role]}>
          <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Sign-in">
        <Field
          label="Username"
          hint={
            !cleanUsername
              ? 'Lowercase; letters, numbers, dots, dashes, underscores.'
              : usernameTaken
                ? 'Already taken.'
                : usernameValid
                  ? `They will sign in as "${cleanUsername}".`
                  : '2–32 characters: letters, numbers, dots, dashes, underscores.'
          }
        >
          <input
            className={cn(inputClass, 'font-mono')}
            value={username}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="e.g. maria"
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 6 characters. Write it down for them now — it is not shown again.">
          <input
            className={cn(inputClass, 'font-mono')}
            type="text"
            value={password}
            autoComplete="new-password"
            placeholder="e.g. Setup-7K2M-44"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </Section>
    </Drawer>
  )
}
