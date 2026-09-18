// Prepared one-click jobs, offered to Charles until he applies them. Each banner
// shows exactly what its click will do — computed against the live database right
// now — and disappears for good once the activity log says it ran.

import { useMemo, useState } from 'react'

import { useToast } from '../components/Toaster'
import { Block, Button, Chip } from '../components/ui'
import { MIGRATIONS, type PreparedMigration } from '../data/migrations'
import { adAccount } from '../selectors'
import { migrationApplied, planMigration, useActions, useStore } from '../store'

export function CleanupBanner() {
  const { currentUser } = useStore()
  if (currentUser.role !== 'MEDIA_BUYER') return null
  return (
    <>
      {MIGRATIONS.map((m) => (
        <MigrationBanner key={m.id} migration={m} />
      ))}
    </>
  )
}

function MigrationBanner({ migration: m }: { migration: PreparedMigration }) {
  const { db, error, clearError } = useStore()
  const { applyMigration } = useActions()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  const applied = migrationApplied(db, m.id)
  const plan = useMemo(() => {
    if (applied) return null
    try {
      return planMigration(db, m.id)
    } catch {
      return null
    }
  }, [db, applied, m.id])

  if (!plan || hidden) return null
  const nothing = plan.retireIds.length === 0 && plan.record.length === 0 && plan.importItems.length === 0
  if (nothing) return null

  const retiring = plan.retireIds.length > 0 || plan.record.length > 0
  const newCbos = plan.importItems.filter((i) => !i.campaignId).length
  const addedTo = plan.importItems.filter((i) => i.campaignId).length
  const adsets = plan.importItems.reduce((n, i) => n + i.adsets.length, 0)
  const newAccounts = new Set(plan.importItems.filter((i) => i.newAccount).map((i) => i.newAccount!.displayName)).size
  const killedCbos = db.campaigns.filter((c) => c.status === 'ACTIVE' && plan.retireIds.includes(c.adAccountId)).length

  const importSentence = `${newCbos} new ${newCbos === 1 ? 'CBO' : 'CBOs'}${
    addedTo ? `, ad sets added to ${addedTo} existing ${addedTo === 1 ? 'CBO' : 'CBOs'}` : ''
  }, ${adsets} ad ${adsets === 1 ? 'set' : 'sets'}${newAccounts ? `, ${newAccounts} new ad ${newAccounts === 1 ? 'account' : 'accounts'}` : ''}`

  return (
    <div className="mb-4 border border-l-2 border-accent-border border-l-accent rounded-r-lg bg-accent-bg">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <Chip tone="accent">{m.chip}</Chip>
        <span className="text-[13px]">
          <strong>{m.title}:</strong>{' '}
          {retiring && (
            <>
              retire {plan.retireIds.length} banned {plan.retireIds.length === 1 ? 'account' : 'accounts'}
              {plan.record.length > 0 && ` (+${plan.record.length} recorded)`}, kill their {killedCbos} {killedCbos === 1 ? 'CBO' : 'CBOs'}, and{' '}
            </>
          )}
          import {m.bookLabel} — {importSentence}. Nothing existing is changed{retiring ? ' beyond that; history untouched' : ''}.
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide details' : 'Show details'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)} title="Hide until the next reload">
          Later
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            if (
              !window.confirm(
                `Apply "${m.title}" now? ${
                  retiring ? `${plan.retireIds.length} accounts → off-boarded, ${killedCbos} CBOs → killed, ` : ''
                }${plan.importItems.length} CBOs imported (${adsets} ad sets). Nothing that went live is deleted. This runs once.`,
              )
            ) {
              return
            }
            if (applyMigration(m.id)) {
              show({
                tone: 'success',
                kind: 'Applied',
                title: m.title,
                body: `${retiring ? `${plan.retireIds.length} accounts retired, ` : ''}${plan.importItems.length} CBOs and ${adsets} ad sets imported${
                  newAccounts ? `, ${newAccounts} new ad accounts created` : ''
                }.`,
                ms: 12000,
              })
            }
          }}
        >
          Apply now
        </Button>
      </div>

      {error && (
        <div className="px-3.5 pb-2.5 text-[13px] text-danger">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {open && (
        <div className="px-3.5 pb-3 grid gap-2 grid-cols-2 max-[900px]:grid-cols-1">
          {retiring && (
            <Block className="max-h-64 overflow-auto">
              {[
                `RETIRE (${plan.retireIds.length})`,
                ...plan.retireIds.map((id) => `  ${adAccount(db, id)?.displayName ?? id}`),
                '',
                `RECORD AS OFF-BOARDED (${plan.record.length})`,
                ...plan.record.map((r) => `  ${r.displayName}`),
                ...(plan.unplaced.length ? ['', `LEFT ALONE — no market in the name (${plan.unplaced.length})`, ...plan.unplaced.map((n) => `  ${n}`)] : []),
              ].join('\n')}
            </Block>
          )}
          <Block className="max-h-64 overflow-auto">
            {[
              `IMPORT (${plan.importItems.length})`,
              ...plan.importItems.map(
                (i) =>
                  `  ${i.campaignId ? '+ into ' + (db.campaigns.find((c) => c.id === i.campaignId)?.name ?? '') : 'new  ' + (i.name ?? '')}${
                    i.productName ? `   [${i.productName}]` : ''
                  }${i.newAccount ? `   (new account ${i.newAccount.displayName})` : ''}   ${i.adsets.length} ad ${i.adsets.length === 1 ? 'set' : 'sets'}`,
              ),
              ...(plan.skipped.length ? ['', `SKIPPED (${plan.skipped.length})`, ...plan.skipped.map((s) => `  ${s.campaignName} — ${s.why}`)] : []),
            ].join('\n')}
          </Block>
        </div>
      )}
    </div>
  )
}
