import { useState } from 'react'
import { FolderX } from 'lucide-react'
import { initRepository, openRepositoryDialog, openRepositoryPath } from '../../stores/repository.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Button } from '../common/Button'
import { Modal } from './Modal'

const folderName = (path: string): string => path.split(/[\\/]/).pop() ?? path

/** A picked folder has no .git: open the repository it belongs to, initialize one, or pick again. */
export function NotRepositoryDialog({ dialog }: { dialog: Extract<Dialog, { type: 'notRepository' }> }) {
  const [busy, setBusy] = useState(false)
  const { path, root, canInit } = dialog

  const chooseAgain = (): void => {
    closeDialog()
    void openRepositoryDialog()
  }

  const init = async (): Promise<void> => {
    setBusy(true)
    if (await initRepository(path)) closeDialog()
    setBusy(false)
  }

  const openRoot = (): void => {
    closeDialog()
    if (root) void openRepositoryPath(root)
  }

  const primary = root
    ? { label: `Open ${folderName(root)}`, run: openRoot }
    : canInit
      ? { label: 'Initialize Repository', run: () => void init() }
      : { label: 'Choose Another Folder…', run: chooseAgain }

  return (
    <Modal
      title="Not a Git repository"
      confirmLabel={primary.label}
      initialFocus="confirm"
      disabled={busy}
      onConfirm={primary.run}
      secondary={
        <>
          {root && canInit && (
            <Button type="button" disabled={busy} onClick={() => void init()}>
              Initialize Here
            </Button>
          )}
          {primary.run !== chooseAgain && (
            <Button type="button" onClick={chooseAgain}>
              Choose Another…
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-3">
        <FolderX size={28} strokeWidth={1.5} className="shrink-0 text-warn" />
        <div className="min-w-0 space-y-2">
          <p>
            <span className="font-medium">{folderName(path)}</span> has no <code className="font-mono">.git</code> folder, so it is not a Git repository.
          </p>
          <p className="selectable truncate font-mono text-[11px] text-faint" title={path}>
            {path}
          </p>
          {root && (
            <p className="text-muted">
              It is inside the repository <span className="font-medium text-fg">{folderName(root)}</span>. Open that repository instead?
            </p>
          )}
          {!root && canInit && <p className="text-muted">You can create a new, empty repository here (git init).</p>}
        </div>
      </div>
    </Modal>
  )
}
