import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function CreateBranchDialog({ dialog }: { dialog: Extract<Dialog, { type: 'createBranch' }> }) {
  const [name, setName] = useState('')
  const [checkout, setCheckout] = useState(true)
  const [busy, setBusy] = useState(false)

  const create = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.createBranch(dialog.repoId, name.trim(), dialog.startPoint, checkout)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title="Create Branch" confirmLabel="Create Branch" disabled={!name.trim() || busy} onConfirm={() => void create()}>
      <label className="block space-y-1">
        <span className="text-muted">Branch name</span>
        <input autoFocus className={inputClass} value={name} placeholder="feature/my-branch" onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} />
      </label>
      <div className="text-muted">
        Base: <span className="font-mono text-fg">{dialog.startPoint ? dialog.startLabel : `current branch (${dialog.startLabel})`}</span>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checkout} onChange={(e) => setCheckout(e.target.checked)} />
        Checkout after create
      </label>
    </Modal>
  )
}
