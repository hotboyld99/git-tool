import { GitBranch, X } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { useState } from 'react'
import { activate, closeRepository, isDirty, moveTab, useRepo, useRepos } from '../../stores/repository.store'
import { openMenu } from '../../stores/ui.store'
import { openInMenu } from './Toolbar'

const TAB_MIME = 'application/x-git-tool-tab'

function Tab({ id, active }: { id: RepositoryId; active: boolean }) {
  const [over, setOver] = useState(false)
  const repo = useRepo(id)
  const branch = repo.status ? (repo.status.branch ?? 'DETACHED HEAD') : ''
  return (
    <div
      title={repo.info.path}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TAB_MIME, id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TAB_MIME)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const from = e.dataTransfer.getData(TAB_MIME)
        if (from) moveTab(from, id)
      }}
      onMouseDown={(e) => e.button === 0 && activate(id)}
      onAuxClick={(e) => e.button === 1 && void closeRepository(id)}
      onContextMenu={(e) =>
        openMenu(e, [
          ...openInMenu(id),
          { label: 'Copy Path', onClick: () => void navigator.clipboard.writeText(repo.info.path) },
          'separator',
          { label: 'Close Repository', onClick: () => void closeRepository(id) }
        ])
      }
      className={`no-drag group flex h-8 max-w-60 min-w-28 shrink-0 items-center gap-2 rounded-t-md border border-b-0 px-3 ${
        active ? 'border-line bg-panel' : 'border-transparent text-muted hover:bg-panel/60'
      } ${over ? 'ring-1 ring-accent' : ''}`}
    >
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-medium">{repo.info.name}</div>
        {/* w-0 min-w-full: the branch line never widens the tab, the project name sets the width */}
        <div className="flex w-0 min-w-full items-center gap-1 text-[10px] text-muted">
          <GitBranch size={10} className="shrink-0" />
          <span className="truncate">{branch}</span>
          {isDirty(repo.status) && <span className="text-warn">●</span>}
        </div>
      </div>
      <button
        title="Close Repository"
        className={`rounded p-0.5 hover:bg-hover ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => void closeRepository(id)}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function TabBar() {
  const order = useRepos((s) => s.order)
  const activeId = useRepos((s) => s.activeId)
  return (
    <div className="flex min-w-0 items-end gap-0.5 overflow-x-auto">
      {order.map((id) => (
        <Tab key={id} id={id} active={id === activeId} />
      ))}
    </div>
  )
}
