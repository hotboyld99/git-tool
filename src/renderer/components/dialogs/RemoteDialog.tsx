import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

/** Adds a remote, or edits the URL of `dialog.name` when given. */
export function RemoteDialog({ dialog }: { dialog: Extract<Dialog, { type: 'remote' }> }) {
  const editing = dialog.name !== undefined
  const [name, setName] = useState(dialog.name ?? '')
  const [url, setUrl] = useState(dialog.url ?? '')
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setBusy(true)
    const result = editing ? await actions.setRemoteUrl(dialog.repoId, name, url) : await actions.addRemote(dialog.repoId, name.trim(), url)
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title={editing ? `Edit remote ${dialog.name}` : 'Add Remote'} confirmLabel={editing ? 'Save' : 'Add Remote'} disabled={!name.trim() || !url.trim() || busy} onConfirm={() => void save()}>
      <label className="block space-y-1">
        <span className="text-muted">Name</span>
        <input autoFocus={!editing} disabled={editing} className={`${inputClass} disabled:opacity-60`} value={name} placeholder="upstream" onChange={(e) => setName(e.target.value.replace(/\s/g, ''))} />
      </label>
      <label className="block space-y-1">
        <span className="text-muted">URL</span>
        <input autoFocus={editing} className={inputClass} value={url} placeholder="git@github.com:owner/repo.git" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <p className="text-faint">Authentication uses your Git configuration (SSH keys, credential helper).</p>
    </Modal>
  )
}
