import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ChangedFile, RepositoryId } from '../../../shared/types'
import { select, selectFile, useRepo, type Selection } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { formatDate } from '../../utils/format'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'
import { FileChangeList } from '../changes/FileChangeList'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-wider text-faint uppercase">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

/** Details of a commit or a stash (a stash is a commit whose first parent is the HEAD it was made on). */
export function CommitDetail({ id, selection }: { id: RepositoryId; selection: Exclude<Selection, { type: 'changes' }> }) {
  const { commits, stashes, selectedFile } = useRepo(id)
  const hash = selection.hash
  const commit = selection.type === 'commit' ? commits.find((c) => c.hash === hash) : undefined
  const stash = selection.type === 'stash' ? stashes.find((s) => s.ref === selection.ref) : undefined
  const [files, setFiles] = useState<ChangedFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFiles(null)
    setError(null)
    void window.git.commitFiles(id, hash).then((r) => {
      if (cancelled) return
      if (r.ok) setFiles(r.data)
      else setError(r.error.stderr)
    })
    return () => {
      cancelled = true
    }
  }, [id, hash])

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-medium">{stash ? stash.ref : 'Commit'}</span>
        <code className="selectable font-mono text-muted">{hash.slice(0, 7)}</code>
        <button title="Back to changes" className="ml-auto rounded p-0.5 text-muted hover:bg-hover hover:text-fg" onClick={() => select(id, { type: 'changes' })}>
          <X size={14} />
        </button>
      </div>

      <div className="selectable max-h-[50%] shrink-0 space-y-3 overflow-y-auto border-b border-line p-3">
        {commit && (
          <>
            <div className="text-[13px] font-medium whitespace-pre-wrap">{commit.subject}</div>
            {commit.body && <div className="whitespace-pre-wrap text-muted">{commit.body}</div>}
            <Field label="Author">
              {commit.authorName} <span className="text-muted">&lt;{commit.authorEmail}&gt;</span>
            </Field>
            <Field label="Date">{formatDate(commit.date)}</Field>
            <Field label="Parents">
              {commit.parents.length === 0 && <span className="text-muted">none (root commit)</span>}
              {commit.parents.map((p) => (
                <button key={p} className="mr-2 font-mono text-accent hover:underline" onClick={() => select(id, { type: 'commit', hash: p })}>
                  {p.slice(0, 7)}
                </button>
              ))}
            </Field>
            {commit.refs.length > 0 && <Field label="Refs">{commit.refs.filter((r) => r !== 'HEAD').join(', ')}</Field>}
          </>
        )}
        {stash && (
          <>
            <div className="text-[13px] font-medium whitespace-pre-wrap">{stash.message}</div>
            <Field label="Branch">{stash.branch}</Field>
            <div className="flex gap-2">
              <Button onClick={() => void actions.stashApply(id, stash.ref)}>Apply</Button>
              <Button onClick={() => void actions.stashPop(id, stash.ref)}>Pop</Button>
              <Button variant="danger" onClick={() => actions.stashDrop(id, stash.ref)}>
                Drop
              </Button>
            </div>
          </>
        )}
        {!commit && !stash && <div className="text-muted">This commit is not in the loaded history.</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <div className="p-3 text-danger">{error}</div>}
        {!files && !error && (
          <div className="flex justify-center p-4 text-muted">
            <Spinner />
          </div>
        )}
        {files && (
          <FileChangeList
            title="Files changed"
            files={files}
            isSelected={(f) => selectedFile?.source === 'commit' && selectedFile.hash === hash && selectedFile.path === f.path}
            onSelect={(f) => selectFile(id, { source: 'commit', hash, path: f.path })}
          />
        )}
      </div>
    </div>
  )
}
