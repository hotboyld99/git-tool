import { FolderGit2, HardDriveDownload, Package, Plus } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { openRepositoryPath, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog, openMenu } from '../../stores/ui.store'
import { SidebarItem, SidebarSection } from './SidebarSection'

const headerButton = 'rounded p-0.5 text-faint hover:bg-hover hover:text-fg'

export function WorktreeList({ id }: { id: RepositoryId }) {
  const { worktrees, info } = useRepo(id)
  return (
    <SidebarSection
      title="Worktrees"
      count={worktrees.length}
      action={
        <button title="Add worktree" className={headerButton} onClick={() => openDialog({ type: 'worktree', repoId: id })}>
          <Plus size={12} />
        </button>
      }
    >
      {worktrees.map((w) => (
        <SidebarItem
          key={w.path}
          icon={FolderGit2}
          label={
            <>
              {w.branch ?? `detached ${w.head.slice(0, 7)}`} <span className="text-faint">{w.path.split(/[\\/]/).pop()}</span>
            </>
          }
          title={w.path}
          bold={w.path === info.path}
          right={w.prunable ? <span className="text-[10px] text-warn">missing</span> : w.locked ? <span className="text-[10px] text-faint">locked</span> : null}
          onDoubleClick={() => void openRepositoryPath(w.path)}
          onContextMenu={(e) =>
            openMenu(e, [
              { label: 'Open as Tab', disabled: w.prunable, onClick: () => void openRepositoryPath(w.path) },
              { label: 'Copy Path', onClick: () => void navigator.clipboard.writeText(w.path) },
              'separator',
              { label: 'Prune Missing Worktrees', onClick: () => void actions.pruneWorktrees(id) },
              { label: 'Remove Worktree…', danger: true, disabled: w.isMain || w.locked, onClick: () => actions.removeWorktree(id, w) }
            ])
          }
        />
      ))}
    </SidebarSection>
  )
}

const SUBMODULE_STATE = { ok: null, uninitialized: 'not initialized', modified: 'changed', conflict: 'conflict' }

export function SubmoduleList({ id }: { id: RepositoryId }) {
  const { submodules, info } = useRepo(id)
  if (submodules.length === 0) return null
  return (
    <SidebarSection
      title="Submodules"
      count={submodules.length}
      action={
        <button title="Update all (init, recursive)" className={headerButton} onClick={() => void actions.updateSubmodules(id)}>
          <HardDriveDownload size={12} />
        </button>
      }
    >
      {submodules.map((s) => (
        <SidebarItem
          key={s.path}
          icon={Package}
          label={s.path}
          title={`${s.path} @ ${s.hash.slice(0, 7)}`}
          right={SUBMODULE_STATE[s.state] && <span className={`text-[10px] ${s.state === 'ok' ? '' : 'text-warn'}`}>{SUBMODULE_STATE[s.state]}</span>}
          onDoubleClick={() => s.state !== 'uninitialized' && void openRepositoryPath(`${info.path}/${s.path}`)}
          onContextMenu={(e) =>
            openMenu(e, [
              { label: 'Open as Tab', disabled: s.state === 'uninitialized', onClick: () => void openRepositoryPath(`${info.path}/${s.path}`) },
              { label: s.state === 'uninitialized' ? 'Initialize & Update' : 'Update', onClick: () => void actions.updateSubmodules(id, s.path) }
            ])
          }
        />
      ))}
    </SidebarSection>
  )
}

export function LfsSection({ id }: { id: RepositoryId }) {
  const { lfs } = useRepo(id)
  if (!lfs?.installed || lfs.patterns.length === 0) return null
  const missing = lfs.files.filter((f) => !f.downloaded).length
  return (
    <SidebarSection
      title="Git LFS"
      count={lfs.files.length}
      action={
        <button title="git lfs pull" className={headerButton} onClick={() => void actions.lfsPull(id)}>
          <HardDriveDownload size={12} />
        </button>
      }
    >
      {lfs.patterns.map((p) => (
        <SidebarItem key={p} icon={HardDriveDownload} label={<span className="font-mono">{p}</span>} title={`Tracked by Git LFS: ${p}`} />
      ))}
      {missing > 0 && (
        <div className="px-5 py-1 text-[11px] text-warn">
          {missing} file{missing === 1 ? '' : 's'} not downloaded —{' '}
          <button className="underline" onClick={() => void actions.lfsPull(id)}>
            pull
          </button>
        </div>
      )}
    </SidebarSection>
  )
}
