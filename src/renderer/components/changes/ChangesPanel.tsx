import { AlertTriangle, ArrowLeftToLine, ArrowRightToLine, Check, Minus, Plus, Undo2 } from 'lucide-react'
import type { GitFileStatus, RepositoryId } from '../../../shared/types'
import { selectFile, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openMenu, type MenuEntry } from '../../stores/ui.store'
import { Spinner } from '../common/Spinner'
import { CommitPanel } from '../commit/CommitPanel'
import { FileChangeList } from './FileChangeList'

const headerButton = 'rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-fg'

const bannerButton = 'rounded border border-warn/40 px-2 py-0.5 hover:bg-warn/20 disabled:opacity-40'

const OPERATION_LABEL = { merge: 'Merge', 'cherry-pick': 'Cherry-pick', revert: 'Revert', rebase: 'Rebase' }

export function ChangesPanel({ id }: { id: RepositoryId }) {
  const { status, selectedFile } = useRepo(id)
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
      { label: 'Discard Changes…', danger: true, onClick: () => actions.discard(id, f) }
    ]
  }
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
      {status.operation && (
        <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/10 px-3 py-2 text-warn">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">
            {OPERATION_LABEL[status.operation]} in progress —{' '}
            {conflictedFiles.length > 0
              ? `resolve ${conflictedFiles.length} conflict${conflictedFiles.length === 1 ? '' : 's'}, then ${status.operation === 'rebase' ? 'continue' : 'commit'}.`
              : status.operation === 'rebase'
                ? 'continue to replay the next commit.'
                : 'commit to finish.'}
          </span>
          {status.operation === 'rebase' && (
            <>
              <button className={bannerButton} disabled={conflictedFiles.length > 0} onClick={() => void actions.rebaseContinue(id)}>
                Continue
              </button>
              <button className={bannerButton} onClick={() => actions.rebaseSkip(id)}>
                Skip
              </button>
            </>
          )}
          <button className={bannerButton} onClick={() => actions.abortOperation(id)}>
            Abort
          </button>
        </div>
      )}
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
            isSelected={isSelected}
            onSelect={show}
            onOpen={openFile}
            onContextMenu={(e, f) => openMenu(e, fileMenu(f))}
          />
        )}
        <FileChangeList
          title="Unstaged Files"
          files={unstagedFiles}
          headerAction={
            unstagedFiles.length > 0 && (
              <button className={headerButton} onClick={() => void actions.stageAll(id)}>
                Stage All
              </button>
            )
          }
          actions={[
            { icon: Undo2, title: 'Discard changes', danger: true, onClick: (f) => actions.discard(id, f) },
            { icon: Plus, title: 'Stage', onClick: (f) => void actions.stage(id, [f.path]) }
          ]}
          isSelected={isSelected}
          onSelect={show}
          onOpen={openFile}
          onContextMenu={(e, f) => openMenu(e, fileMenu(f))}
        />
        <FileChangeList
          title="Staged Files"
          files={stagedFiles}
          headerAction={
            stagedFiles.length > 0 && (
              <button className={headerButton} onClick={() => void actions.unstageAll(id)}>
                Unstage All
              </button>
            )
          }
          actions={[{ icon: Minus, title: 'Unstage', onClick: (f) => void actions.unstage(id, [f.path]) }]}
          isSelected={isSelected}
          onSelect={show}
          onOpen={openFile}
          onContextMenu={(e, f) => openMenu(e, fileMenu(f))}
        />
      </div>
      {status.operation !== 'rebase' && <CommitPanel id={id} />}
    </div>
  )
}
