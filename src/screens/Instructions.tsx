// Charles's instructions to the setup team, as they appear on a task: "just use
// the 09/18/26 swipes and relaunch it here", "duplicate the top 3 ads only".
// The app does not hold the ads themselves — they live in Meta and Drive — so
// this free text is how Charles says exactly which ones to set up and how.
//
// Setup and QA read it. Charles edits it in place until the launch is live.

import { useState } from 'react'

import { useToast } from '../components/Toaster'
import { Button, Chip, cn, textareaClass } from '../components/ui'
import { formatTime } from '../naming'
import { rowForSetupTask } from '../selectors'
import { useActions, useStore } from '../store'

export function InstructionsPanel({ taskId, className }: { taskId: string; className?: string }) {
  const { db, currentUser } = useStore()
  const { setInstructions } = useActions()
  const { show } = useToast()
  const task = db.setupTasks.find((t) => t.id === taskId)
  const row = rowForSetupTask(db, taskId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!task || !row) return null
  const canEdit = currentUser.role === 'MEDIA_BUYER' && task.status !== 'COMPLETED'
  const text = task.instructions?.trim()

  if (!text && !canEdit) return null

  const startEditing = () => {
    setDraft(text ?? '')
    setEditing(true)
  }

  const save = () => {
    const next = draft.trim()
    if (next === (text ?? '')) {
      setEditing(false)
      return
    }
    if (setInstructions(task.id, next)) {
      show({
        tone: 'success',
        kind: next ? 'Instructions updated' : 'Instructions removed',
        title: `${row.adset.name} · ${row.campaign.name}`,
        body: next ? 'The setup team has been notified.' : 'Setup will follow the names alone.',
      })
      setEditing(false)
    }
  }

  return (
    <div
      className={cn(
        'px-[13px] py-[11px] mb-4 border border-l-2 border-accent-border border-l-accent rounded-r-lg bg-accent-bg',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Chip tone="accent">📝 Instructions from Charles</Chip>
        {task.instructionsAt && !editing && (
          <span className="text-xs text-fg-tertiary">{formatTime(task.instructionsAt)}</span>
        )}
        <span className="flex-1" />
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={startEditing}>
            {text ? 'Edit' : '+ Add instructions'}
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            className={cn(textareaClass, 'bg-surface')}
            value={draft}
            autoFocus
            placeholder="e.g. Just use the 09/18/26 swipes and relaunch it here. Same budget, same targeting."
            onFocus={(e) => {
              // Caret at the end: editing usually means appending a line.
              const end = e.currentTarget.value.length
              e.currentTarget.setSelectionRange(end, end)
            }}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-1.5 mt-2">
            <Button size="sm" variant="primary" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {text && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  setDraft('')
                  if (setInstructions(task.id, undefined)) setEditing(false)
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </>
      ) : text ? (
        <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{text}</div>
      ) : (
        <div className="text-xs text-fg-tertiary">
          Nothing typed yet — setup will follow the names and the Drive link alone.
        </div>
      )}
    </div>
  )
}
