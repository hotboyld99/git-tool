import { useEffect, useState } from 'react'
import type { AppSettings, Result } from '../../../shared/types'
import { closeDialog, showError } from '../../stores/ui.store'
import { Button } from '../common/Button'
import { Modal } from './Modal'

export function SettingsDialog() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const apply = (result: Result<AppSettings | null>): void => {
    if (!result.ok) showError(result.error)
    else if (result.data) setSettings(result.data)
  }

  useEffect(() => {
    void window.system.settings().then(apply)
  }, [])

  return (
    <Modal title="Settings" confirmLabel="Done" initialFocus="confirm" onConfirm={closeDialog}>
      <div className="space-y-1">
        <div className="text-[10px] font-semibold tracking-wider text-faint uppercase">Git executable</div>
        <div className="selectable truncate font-mono" title={settings?.gitPath ?? undefined}>
          {settings ? (settings.gitPath ?? 'git (from PATH)') : '…'}
        </div>
        <div className={`text-[11px] ${settings?.gitVersion.startsWith('git version') ? 'text-muted' : 'text-danger'}`}>{settings?.gitVersion}</div>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void window.system.pickGitExecutable().then(apply)}>
          Choose…
        </Button>
        <Button type="button" disabled={!settings?.gitPath} onClick={() => void window.system.resetGitExecutable().then(apply)}>
          Use Git from PATH
        </Button>
      </div>
    </Modal>
  )
}
