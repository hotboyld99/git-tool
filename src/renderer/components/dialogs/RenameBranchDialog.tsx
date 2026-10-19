import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function RenameBranchDialog({ dialog }: { dialog: Extract<Dialog, { type: 'renameBranch' }> }) {
  const [name, setName] = useState(dialog.name)
  const [busy, setBusy] = useState(false)
  const newName = name.trim()

  const rename = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.renameBranch(dialog.repoId, dialog.name, newName)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title="Rename Branch" confirmLabel="Rename" disabled={!newName || newName === dialog.name || busy} onConfirm={() => void rename()}>
      <label className="block space-y-1">
        <span className="text-muted">
          New name for <span className="font-mono text-fg">{dialog.name}</span>
        </span>
        <input autoFocus onFocus={(e) => e.target.select()} className={inputClass} value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} />
      </label>
      <div className="text-faint">The remote branch is not renamed.</div>
    </Modal>
  )
}
