// The prepared clean-up, offered to Charles until he applies it. Shows exactly
// what one click will do — computed against the live database right now — and
// disappears for good once the activity log says it ran.

import { useMemo, useState } from 'react'

import { useToast } from '../components/Toaster'
import { Block, Button, Chip, cn } from '../components/ui'
import { RESTRICTION_WAVE_ID } from '../data/restrictionWave'
import { adAccount } from '../selectors'
import { migrationApplied, planMigration, useActions, useStore } from '../store'

export function CleanupBanner() {
  const { db, currentUser, error, clearError } = useStore()
  const { applyMigration } = useActions()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  const applied = migrationApplied(db, RESTRICTION_WAVE_ID)
  const plan = useMemo(() => {
    if (applied || currentUser.role !== 'MEDIA_BUYER') return null
    try {
      return planMigration(db, RESTRICTION_WAVE_ID)
    } catch {
      return null
    }
  }, [db, applied, currentUser.role])

  if (!plan || hidden) return null
  const nothing = plan.retireIds.length === 0 && plan.record.length === 0 && plan.importItems.length === 0
  if (nothing) return null

  const newCbos = plan.importItems.filter((i) => !i.campaignId).length
  const adsets = plan.importItems.reduce((n, i) => n + i.adsets.length, 0)
  const newAccounts = new Set(plan.importItems.filter((i) => i.newAccount).map((i) => i.newAccount!.displayName)).size
  const killedCbos = db.campaigns.filter((c) => c.status === 'ACTIVE' && plan.retireIds.includes(c.adAccountId)).length

  return (
    <div className="mb-4 border border-l-2 border-accent-border border-l-accent rounded-r-lg bg-accent-bg">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <Chip tone="accent">Prepared clean-up · 16 Sep</Chip>
        <span className="text-[13px]">
          <strong>Restriction wave:</strong> retire {plan.retireIds.length} banned {plan.retireIds.length === 1 ? 'account' : 'accounts'}
          {plan.record.length > 0 && ` (+${plan.record.length} recorded)`}, kill their {killedCbos} {killedCbos === 1 ? 'CBO' : 'CBOs'}, and import
          the new UK and US book — {newCbos} new {newCbos === 1 ? 'CBO' : 'CBOs'}, {adsets} ad {adsets === 1 ? 'set' : 'sets'}
          {newAccounts > 0 && `, ${newAccounts} new ${newAccounts === 1 ? 'account' : 'accounts'}`}. History untouched.
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
                `Apply the clean-up now? ${plan.retireIds.length} accounts → off-boarded, ${killedCbos} CBOs → killed, ${plan.importItems.length} CBOs imported. Nothing that went live is deleted. This runs once.`,
              )
            ) {
              return
            }
            if (applyMigration(RESTRICTION_WAVE_ID)) {
              show({
                tone: 'success',
                kind: 'Clean-up applied',
                title: 'Restriction wave',
                body: `${plan.retireIds.length} accounts retired, ${plan.importItems.length} CBOs imported. The workspace now shows the new book; the old one is under Killed and Off-boarded.`,
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
        <div className={cn('px-3.5 pb-3 grid gap-2', 'max-[900px]:grid-cols-1 grid-cols-2')}>
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
          <Block className="max-h-64 overflow-auto">
            {[
              `IMPORT (${plan.importItems.length})`,
              ...plan.importItems.map(
                (i) =>
                  `  ${i.campaignId ? '+ into ' + (db.campaigns.find((c) => c.id === i.campaignId)?.name ?? '') : 'new  ' + (i.name ?? '')}${
                    i.newAccount ? `   (new account ${i.newAccount.displayName})` : ''
                  }   ${i.adsets.length} ad ${i.adsets.length === 1 ? 'set' : 'sets'}`,
              ),
              ...(plan.skipped.length ? ['', `SKIPPED (${plan.skipped.length})`, ...plan.skipped.map((s) => `  ${s.campaignName} — ${s.why}`)] : []),
            ].join('\n')}
          </Block>
        </div>
      )}
    </div>
  )
}
