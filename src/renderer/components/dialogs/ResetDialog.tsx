import { useState } from 'react'
import type { ResetMode } from '../../../shared/types'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal } from './Modal'

const MODES: { mode: ResetMode; title: string; description: string }[] = [
  { mode: 'soft', title: 'Soft', description: 'Keep all changes, staged.' },
  { mode: 'mixed', title: 'Mixed', description: 'Keep all changes, unstaged.' },
  { mode: 'hard', title: 'Hard', description: 'Discard all changes. Uncommitted work is lost.' }
]

export function ResetDialog({ dialog }: { dialog: Extract<Dialog, { type: 'reset' }> }) {
  const [mode, setMode] = useState<ResetMode>('mixed')
  const [busy, setBusy] = useState(false)

  const reset = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.reset(dialog.repoId, dialog.hash, mode)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal
      title={`Reset ${dialog.branch} to ${dialog.label}`}
      confirmLabel={mode === 'hard' ? 'Reset (Hard)' : 'Reset'}
      danger={mode === 'hard'}
      initialFocus="cancel"
      disabled={busy}
      onConfirm={() => void reset()}
    >
      {MODES.map((m) => (
        <label key={m.mode} className={`flex items-start gap-2 rounded border p-2 ${mode === m.mode ? 'border-accent bg-accent/10' : 'border-line'}`}>
          <input type="radio" name="mode" className="mt-0.5" checked={mode === m.mode} onChange={() => setMode(m.mode)} />
          <span>
            <span className="font-medium">{m.title}</span>
            <span className={`block ${m.mode === 'hard' ? 'text-danger' : 'text-muted'}`}>{m.description}</span>
          </span>
        </label>
      ))}
    </Modal>
  )
}
