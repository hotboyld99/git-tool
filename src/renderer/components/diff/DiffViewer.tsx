import { useEffect, useMemo, useState } from 'react'
import { Copy, Minus, Plus, RotateCw, X } from 'lucide-react'
import type { DiffRequest, FileDiff, RepositoryId } from '../../../shared/types'
import { selectFile, useRepo, type SelectedFile } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { setUi, useUi } from '../../stores/ui.store'
import { errorSummary } from '../../utils/format'
import { languageOf } from '../../utils/highlight'
import { Spinner } from '../common/Spinner'
import { UnifiedDiff } from './UnifiedDiff'
import { SplitDiff } from './SplitDiff'

const toggle = (active: boolean): string =>
  `rounded px-2 py-0.5 text-[11px] ${active ? 'bg-accent/25 text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`
const iconButton = 'rounded p-1 text-muted hover:bg-hover hover:text-fg'

export function DiffViewer({ id, file }: { id: RepositoryId; file: SelectedFile }) {
  const { status } = useRepo(id)
  const diffMode = useUi((s) => s.diffMode)
  const ignoreWhitespace = useUi((s) => s.ignoreWhitespace)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const request = useMemo<DiffRequest>(
    () =>
      file.source === 'commit'
        ? { kind: 'commit', hash: file.hash, path: file.path, ignoreWhitespace }
        : { kind: 'working', path: file.path, staged: file.staged, untracked: file.untracked, ignoreWhitespace },
    [file, ignoreWhitespace]
  )
  // working-tree diffs follow status refreshes (file watcher); commit diffs never change
  const statusVersion = file.source === 'working' ? status : null

  useEffect(() => {
    let cancelled = false
    void window.git.diff(id, request).then((r) => {
      if (cancelled) return
      setDiff(r.ok ? r.data : null)
      setError(r.ok ? null : errorSummary(r.error.stderr) || 'Could not load diff.')
    })
    return () => {
      cancelled = true
    }
  }, [id, request, statusVersion, reload])

  const language = languageOf(file.path)

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
          {file.path}
          {file.source === 'working' && <span className="ml-2 font-sans text-faint">{file.staged ? 'staged' : 'unstaged'}</span>}
        </span>
        <div className="flex rounded border border-line p-0.5">
          <button className={toggle(diffMode === 'unified')} onClick={() => setUi({ diffMode: 'unified' })}>
            Unified
          </button>
          <button className={toggle(diffMode === 'split')} onClick={() => setUi({ diffMode: 'split' })}>
            Split
          </button>
        </div>
        <button className={toggle(ignoreWhitespace)} title="Ignore whitespace changes" onClick={() => setUi({ ignoreWhitespace: !ignoreWhitespace })}>
          Whitespace
        </button>
        <button className={iconButton} title="Copy diff" disabled={!diff} onClick={() => diff && void navigator.clipboard.writeText(diff.raw)}>
          <Copy size={14} />
        </button>
        <button className={iconButton} title="Refresh" onClick={() => setReload((n) => n + 1)}>
          <RotateCw size={14} />
        </button>
        {file.source === 'working' &&
          (file.staged ? (
            <button
              className={iconButton}
              title="Unstage file"
              onClick={() => void actions.unstage(id, [file.path]).then((r) => r.ok && selectFile(id, { ...file, staged: false }))}
            >
              <Minus size={14} />
            </button>
          ) : (
            <button
              className={iconButton}
              title="Stage file"
              onClick={() => void actions.stage(id, [file.path]).then((r) => r.ok && selectFile(id, { ...file, staged: true, untracked: false }))}
            >
              <Plus size={14} />
            </button>
          ))}
        <button className={iconButton} title="Close diff" onClick={() => selectFile(id, null)}>
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {error ? (
          <div className="p-4 text-danger">{error}</div>
        ) : !diff ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : diff.binary ? (
          <div className="p-6 text-center text-muted">Binary file changed.</div>
        ) : diff.hunks.length === 0 ? (
          <div className="p-6 text-center text-muted">No changes{ignoreWhitespace ? ' (whitespace ignored)' : ''}.</div>
        ) : diffMode === 'split' ? (
          <SplitDiff hunks={diff.hunks} language={language} />
        ) : (
          <UnifiedDiff hunks={diff.hunks} language={language} />
        )}
      </div>
    </div>
  )
}
