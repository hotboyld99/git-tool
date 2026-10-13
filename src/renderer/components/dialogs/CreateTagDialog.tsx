import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function CreateTagDialog({ dialog }: { dialog: Extract<Dialog, { type: 'createTag' }> }) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.createTag(dialog.repoId, name.trim(), dialog.hash, message)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title="Create Tag" confirmLabel="Create Tag" disabled={!name.trim() || busy} onConfirm={() => void create()}>
      <label className="block space-y-1">
        <span className="text-muted">Tag name</span>
        <input autoFocus className={inputClass} value={name} placeholder="v1.0.0" onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} />
      </label>
      <label className="block space-y-1">
        <span className="text-muted">Message (optional, creates an annotated tag)</span>
        <input className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <div className="text-muted">
        Target: <span className="font-mono text-fg">{dialog.label}</span>
      </div>
    </Modal>
  )
}
