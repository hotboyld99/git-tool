import { useState } from 'react'
import { actions } from '../../stores/git.store'
import { useRepo } from '../../stores/repository.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal, inputClass } from './Modal'

export function FlowStartDialog({ dialog }: { dialog: Extract<Dialog, { type: 'flowStart' }> }) {
  const { flow } = useRepo(dialog.repoId)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  if (!flow) return null
  const base = dialog.kind === 'hotfix' ? flow.main : flow.develop

  const start = async (): Promise<void> => {
    setBusy(true)
    const result = await actions.gitFlowStart(dialog.repoId, dialog.kind, name.trim())
    setBusy(false)
    if (result.ok) closeDialog()
  }

  return (
    <Modal title={`Start ${dialog.kind}`} confirmLabel={`Start ${dialog.kind}`} disabled={!name.trim() || busy} onConfirm={() => void start()}>
      <label className="block space-y-1">
        <span className="text-muted">{dialog.kind === 'feature' ? 'Feature name' : 'Version'}</span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-muted">{flow[dialog.kind]}</span>
          <input
            autoFocus
            className={inputClass}
            value={name}
            placeholder={dialog.kind === 'feature' ? 'login-page' : '1.2.0'}
            onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))}
          />
        </div>
      </label>
      <div className="text-muted">
        Branches from <span className="font-mono text-fg">{base}</span>
      </div>
    </Modal>
  )
}
