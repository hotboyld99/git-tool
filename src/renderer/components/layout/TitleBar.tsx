import { History, Plus, Settings } from 'lucide-react'
import { openRepositoryDialog, openRepositoryPath, useRepos } from '../../stores/repository.store'
import { openDialog, openMenu } from '../../stores/ui.store'
import { TabBar } from './TabBar'

export function TitleBar() {
  const recent = useRepos((s) => s.recent)
  const mac = window.system.platform === 'darwin'
  return (
    <header className="drag flex h-10 shrink-0 items-end gap-1 border-b border-line bg-bg pr-2" style={{ paddingLeft: mac ? 80 : 8 }}>
      <TabBar />
      <button
        title="Open Repository (Ctrl/⌘+O)"
        className="no-drag mb-1 rounded p-1.5 text-muted hover:bg-hover hover:text-fg"
        onClick={() => void openRepositoryDialog()}
      >
        <Plus size={15} />
      </button>
      <button
        title="Recent Repositories"
        disabled={recent.length === 0}
        className="no-drag mb-1 rounded p-1.5 text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
        onClick={(e) => openMenu(e, recent.map((path) => ({ label: path, onClick: () => void openRepositoryPath(path) })))}
      >
        <History size={15} />
      </button>
      <button title="Settings" className="no-drag mb-1 ml-auto rounded p-1.5 text-muted hover:bg-hover hover:text-fg" onClick={() => openDialog({ type: 'settings' })}>
        <Settings size={15} />
      </button>
    </header>
  )
}
