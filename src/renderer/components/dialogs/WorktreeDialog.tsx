import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { useRepo } from '../../stores/repository.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function WorktreeDialog({ dialog }: { dialog: Extract<Dialog, { type: 'worktree' }> }) {
  const { branches, worktrees } = useRepo(dialog.repoId)
  // a branch can be checked out in only one worktree
  const free = branches.filter((b) => !b.isRemote && !worktrees.some((w) => w.branch === b.name)).map((b) => b.name)
  const [create, setCreate] = useState(true)
  const [name, setName] = useState('')
  const [existing, setExisting] = useState(free[0] ?? '')
  const [busy, setBusy] = useState(false)
  const branch = create ? name.trim() : existing

  const add = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.addWorktree(dialog.repoId, branch, create)
    setBusy(false)
    // data null = folder picker cancelled: keep the dialog open
    if (result.ok && result.data) closeDialog()
  }

  return (
    <Modal title="Add Worktree" confirmLabel="Choose Folder…" disabled={!branch || busy} onConfirm={() => void add()}>
      <p className="text-muted">A worktree is a second working folder of this repository with another branch checked out.</p>
      <label className="flex items-center gap-2">
        <input type="radio" checked={create} onChange={() => setCreate(true)} />
        New branch from HEAD
      </label>
      {create && <input autoFocus className={inputClass} value={name} placeholder="feature/parallel-work" onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} />}
      <label className={`flex items-center gap-2 ${free.length ? '' : 'opacity-40'}`}>
        <input type="radio" disabled={!free.length} checked={!create} onChange={() => setCreate(false)} />
        Existing branch
      </label>
      {!create && (
        <select className={inputClass} value={existing} onChange={(e) => setExisting(e.target.value)}>
          {free.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      )}
    </Modal>
  )
}
