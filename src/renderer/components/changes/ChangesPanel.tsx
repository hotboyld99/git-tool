import { useState, type MouseEvent } from 'react'
import { ArrowLeftToLine, ArrowRightToLine, Check, Minus, Plus, Undo2 } from 'lucide-react'
import type { GitFileStatus, RepositoryId } from '../../../shared/types'
import { selectFile, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openMenu, type MenuEntry } from '../../stores/ui.store'
import { pick } from '../../utils/pick'
import { Spinner } from '../common/Spinner'
import { CommitPanel } from '../commit/CommitPanel'
import { FileChangeList } from './FileChangeList'

const headerButton = 'rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-fg'

type ListKey = 'conflicted' | 'unstaged' | 'staged'

export function ChangesPanel({ id }: { id: RepositoryId }) {
  const { status, selectedFile } = useRepo(id)
  // multi-selection lives in one list at a time; paths that left the list (staged, discarded) simply drop out
  const [picked, setPicked] = useState<{ list: ListKey; paths: string[]; anchor: string | null }>({ list: 'unstaged', paths: [], anchor: null })
  if (!status) {
    return (
      <div className="flex h-full items-center justify-center bg-panel text-muted">
        <Spinner />
      </div>
    )
  }

  const { stagedFiles, unstagedFiles, conflictedFiles } = status
  const total = stagedFiles.length + unstagedFiles.length + conflictedFiles.length
  const isSelected = (f: GitFileStatus): boolean => selectedFile?.source === 'working' && selectedFile.path === f.path && selectedFile.staged === f.staged
  const show = (f: GitFileStatus): void =>
    selectFile(id, { source: 'working', path: f.path, staged: f.staged, untracked: f.status === 'untracked', conflicted: f.status === 'conflicted' })
  const openFile = (f: GitFileStatus): void => void window.system.openFile(id, f.path)
  const changeEntries = (f: GitFileStatus): MenuEntry[] => {
    if (f.status === 'conflicted') {
      return [
        { label: 'Use Ours (current branch)', onClick: () => void actions.resolveConflict(id, f.path, 'ours') },
        { label: 'Use Theirs (incoming)', onClick: () => void actions.resolveConflict(id, f.path, 'theirs') },
        { label: 'Mark as Resolved', onClick: () => void actions.stage(id, [f.path]) }
      ]
    }
    if (f.staged) return [{ label: 'Unstage', onClick: () => void actions.unstage(id, [f.path]) }]
    return [
      { label: 'Stage', onClick: () => void actions.stage(id, [f.path]) },
      { label: 'Discard Changes…', danger: true, onClick: () => actions.discard(id, [f]) }
    ]
  }
  const bulkMenu = (list: ListKey, files: GitFileStatus[]): MenuEntry[] => {
    const paths = files.map((f) => f.path)
    const n = `${files.length} Files`
    if (list === 'conflicted') return [{ label: `Mark ${n} as Resolved`, onClick: () => void actions.stage(id, paths) }]
    if (list === 'staged') return [{ label: `Unstage ${n}`, onClick: () => void actions.unstage(id, paths) }]
    return [
      { label: `Stage ${n}`, onClick: () => void actions.stage(id, paths) },
      { label: `Discard ${n}…`, danger: true, onClick: () => actions.discard(id, files) }
    ]
  }

  /** click / Cmd-Ctrl-click / Shift-click picking and the matching context menu for one list */
  const pickable = (list: ListKey, files: GitFileStatus[]) => {
    const mine = picked.list === list
    const pickedFiles = mine ? files.filter((f) => picked.paths.includes(f.path)) : []
    return {
      pickedFiles,
      isSelected: (f: GitFileStatus): boolean => pickedFiles.includes(f) || (pickedFiles.length === 0 && isSelected(f)),
      onSelect: (f: GitFileStatus, e: MouseEvent): void => {
        const order = files.map((x) => x.path)
        const paths = pick(order, pickedFiles.map((x) => x.path), mine ? picked.anchor : null, f.path, { toggle: e.metaKey || e.ctrlKey, range: e.shiftKey })
        setPicked({ list, paths, anchor: e.shiftKey && mine ? picked.anchor : f.path })
        if (paths.includes(f.path)) show(f)
      },
      onContextMenu: (e: MouseEvent, f: GitFileStatus): void => {
        if (pickedFiles.length > 1 && pickedFiles.includes(f)) return openMenu(e, bulkMenu(list, pickedFiles))
        setPicked({ list, paths: [f.path], anchor: f.path })
        openMenu(e, fileMenu(f))
      }
    }
  }
  const conflicted = pickable('conflicted', conflictedFiles)
  const unstaged = pickable('unstaged', unstagedFiles)
  const staged = pickable('staged', stagedFiles)
  const fileMenu = (f: GitFileStatus): MenuEntry[] => [
    ...changeEntries(f),
    'separator',
    { label: 'Open File', disabled: f.status === 'deleted', onClick: () => openFile(f) },
    { label: 'Open in VS Code', disabled: f.status === 'deleted', onClick: () => void window.system.openInEditor(id, f.path) },
    { label: window.system.platform === 'darwin' ? 'Reveal in Finder' : 'Reveal in Explorer', disabled: f.status === 'deleted', onClick: () => void window.system.reveal(id, f.path) },
    { label: 'Copy Path', onClick: () => void navigator.clipboard.writeText(f.path) }
  ]

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center border-b border-line px-3">
        <span className="font-medium">
          {total === 0 ? 'No changes' : `${total} file change${total === 1 ? '' : 's'}`}
          {status.branch && <span className="text-muted"> on {status.branch}</span>}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conflictedFiles.length > 0 && (
          <FileChangeList
            title="Merge Conflicts"
            tone="danger"
            files={conflictedFiles}
            actions={[
              { icon: ArrowLeftToLine, title: 'Use ours (current branch)', onClick: (f) => void actions.resolveConflict(id, f.path, 'ours') },
              { icon: ArrowRightToLine, title: 'Use theirs (incoming)', onClick: (f) => void actions.resolveConflict(id, f.path, 'theirs') },
              { icon: Check, title: 'Mark as resolved (stage)', onClick: (f) => void actions.stage(id, [f.path]) }
            ]}
            isSelected={conflicted.isSelected}
            onSelect={conflicted.onSelect}
            onOpen={openFile}
            onContextMenu={conflicted.onContextMenu}
          />
        )}
        <FileChangeList
          title="Unstaged Files"
          files={unstagedFiles}
          headerAction={
            unstaged.pickedFiles.length > 1 ? (
              <>
                <button className={`${headerButton} hover:text-danger`} onClick={() => actions.discard(id, unstaged.pickedFiles)}>
                  Discard ({unstaged.pickedFiles.length})
                </button>
                <button className={headerButton} onClick={() => void actions.stage(id, unstaged.pickedFiles.map((f) => f.path))}>
                  Stage ({unstaged.pickedFiles.length})
                </button>
              </>
            ) : (
              unstagedFiles.length > 0 && (
                <button className={headerButton} onClick={() => void actions.stageAll(id)}>
                  Stage All
                </button>
              )
            )
          }
          actions={[
            { icon: Undo2, title: 'Discard changes', danger: true, onClick: (f) => actions.discard(id, [f]) },
            { icon: Plus, title: 'Stage', onClick: (f) => void actions.stage(id, [f.path]) }
          ]}
          isSelected={unstaged.isSelected}
          onSelect={unstaged.onSelect}
          onOpen={openFile}
          onContextMenu={unstaged.onContextMenu}
        />
        <FileChangeList
          title="Staged Files"
          files={stagedFiles}
          headerAction={
            staged.pickedFiles.length > 1 ? (
              <button className={headerButton} onClick={() => void actions.unstage(id, staged.pickedFiles.map((f) => f.path))}>
                Unstage ({staged.pickedFiles.length})
              </button>
            ) : (
              stagedFiles.length > 0 && (
                <button className={headerButton} onClick={() => void actions.unstageAll(id)}>
                  Unstage All
                </button>
              )
            )
          }
          actions={[{ icon: Minus, title: 'Unstage', onClick: (f) => void actions.unstage(id, [f.path]) }]}
          isSelected={staged.isSelected}
          onSelect={staged.onSelect}
          onOpen={openFile}
          onContextMenu={staged.onContextMenu}
        />
      </div>
      {status.operation !== 'rebase' && <CommitPanel id={id} />}
    </div>
  )
}
