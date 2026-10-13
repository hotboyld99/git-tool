import type { ComponentType } from 'react'
import { Archive, ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, CloudDownload, GitBranch, GitBranchPlus, RotateCw, X } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { isDirty, refreshAll, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog } from '../../stores/ui.store'
import { Spinner } from '../common/Spinner'

interface ToolButtonProps {
  icon: ComponentType<{ size?: number }>
  label: string
  title: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  badge?: number
}

function ToolButton({ icon: Icon, label, title, onClick, busy, disabled, badge }: ToolButtonProps) {
  return (
    <button
      title={title}
      disabled={disabled || busy}
      onClick={onClick}
      className="relative flex w-14 flex-col items-center gap-0.5 rounded py-1 text-[11px] text-muted hover:bg-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {busy ? <Spinner size={16} /> : <Icon size={16} />}
      {label}
      {!!badge && <span className="absolute top-0 right-1.5 rounded-full bg-accent px-1 text-[9px] leading-3.5 text-white">{badge}</span>}
    </button>
  )
}

export function Toolbar({ id }: { id: RepositoryId }) {
  const { status, loading, progress, stashes } = useRepo(id)
  const network = loading.fetching ? 'Fetching…' : loading.pulling ? 'Pulling…' : loading.pushing ? 'Pushing…' : null
  const detached = status && status.branch === null

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-line bg-panel px-3">
      <div className="flex w-56 min-w-0 items-center gap-1.5">
        <GitBranch size={14} className="shrink-0 text-muted" />
        {detached ? (
          <span className="rounded bg-warn/20 px-1.5 py-0.5 text-[11px] font-semibold text-warn">DETACHED HEAD {status.head.slice(0, 7)}</span>
        ) : (
          <span className="truncate font-medium">{status?.branch ?? '…'}</span>
        )}
        {status?.upstream && <span className="truncate text-[11px] text-faint">→ {status.upstream}</span>}
      </div>

      <div className="mx-auto flex items-center gap-1">
        <ToolButton icon={ArrowDownToLine} label="Pull" title="Pull (Ctrl/⌘+Shift+L)" badge={status?.behind} busy={loading.pulling} disabled={!!network} onClick={() => void actions.pull(id)} />
        <ToolButton icon={ArrowUpFromLine} label="Push" title="Push (Ctrl/⌘+Shift+P)" badge={status?.ahead} busy={loading.pushing} disabled={!!network || !!detached} onClick={() => void actions.push(id)} />
        <ToolButton icon={CloudDownload} label="Fetch" title="Fetch all remotes (Ctrl/⌘+Shift+F)" busy={loading.fetching} disabled={!!network} onClick={() => void actions.fetch(id)} />
        <div className="mx-2 h-7 border-l border-line" />
        <ToolButton
          icon={GitBranchPlus}
          label="Branch"
          title="Create branch"
          onClick={() => openDialog({ type: 'createBranch', repoId: id, startPoint: null, startLabel: status?.branch ?? 'HEAD' })}
        />
        <ToolButton icon={Archive} label="Stash" title="Stash changes" disabled={!isDirty(status)} onClick={() => openDialog({ type: 'stash', repoId: id })} />
        <ToolButton icon={ArchiveRestore} label="Pop" title="Pop latest stash" disabled={stashes.length === 0} onClick={() => void actions.stashPop(id, stashes[0].ref)} />
        <div className="mx-2 h-7 border-l border-line" />
        <ToolButton icon={RotateCw} label="Refresh" title="Refresh (Ctrl/⌘+R)" busy={loading.status} onClick={() => void refreshAll(id)} />
      </div>

      <div className="flex w-56 min-w-0 items-center justify-end gap-2 text-[11px] text-muted">
        {network && (
          <>
            <Spinner size={12} />
            <span className="truncate" title={progress}>
              {progress || network}
            </span>
            <button title="Cancel" className="rounded p-0.5 hover:bg-hover hover:text-fg" onClick={() => actions.cancel(id)}>
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
