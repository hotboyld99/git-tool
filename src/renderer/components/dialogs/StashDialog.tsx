import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function StashDialog({ dialog }: { dialog: Extract<Dialog, { type: 'stash' }> }) {
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)
  const [busy, setBusy] = useState(false)

  const stash = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.stash(dialog.repoId, message, includeUntracked)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title="Stash Changes" confirmLabel="Stash" disabled={busy} onConfirm={() => void stash()}>
      <label className="block space-y-1">
        <span className="text-muted">Stash message (optional)</span>
        <input autoFocus className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={includeUntracked} onChange={(e) => setIncludeUntracked(e.target.checked)} />
        Include untracked files
      </label>
    </Modal>
  )
}
