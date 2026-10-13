import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { GitCommit, RebaseAction } from '../../../shared/types'
import { actions } from '../../stores/git.store'
import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Spinner } from '../common/Spinner'
import { Modal, inputClass } from './Modal'

interface Row {
  commit: GitCommit
  action: RebaseAction
  message: string
}

const ACTIONS: RebaseAction[] = ['pick', 'reword', 'squash', 'fixup', 'drop']

/** Rows are shown newest first (like the graph); Git's todo list is the same list reversed. */
function problem(rows: Row[]): string | null {
  const kept = rows.filter((r) => r.action !== 'drop')
  if (kept.length === 0) return 'Keep at least one commit (or reset instead).'
  const oldest = kept[kept.length - 1]
  if (oldest.action === 'squash' || oldest.action === 'fixup') return 'The oldest kept commit has nothing below it to squash into.'
  if (rows.some((r) => r.action === 'reword' && !r.message.trim())) return 'Reworded commits need a message.'
  return null
}

export function InteractiveRebaseDialog({ dialog }: { dialog: Extract<Dialog, { type: 'interactiveRebase' }> }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [merges, setMerges] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.git.rebaseCommits(dialog.repoId, dialog.base).then((r) => {
      if (!r.ok) return setError(r.error.stderr)
      setMerges(r.data.merges)
      setRows(
        [...r.data.commits].reverse().map((commit) => ({
          commit,
          action: 'pick',
          message: commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject
        }))
      )
    })
  }, [dialog.repoId, dialog.base])

  const update = (index: number, patch: Partial<Row>): void => setRows((rs) => rs && rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const move = (index: number, delta: number): void =>
    setRows((rs) => {
      if (!rs || index + delta < 0 || index + delta >= rs.length) return rs
      const next = [...rs]
      ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
      return next
    })

  const issue = rows ? problem(rows) : null

  const start = async (): Promise<void> => {
    if (!rows) return
    setBusy(true)
    const steps = [...rows].reverse().map((r) => ({ hash: r.commit.hash, action: r.action, message: r.action === 'reword' ? r.message : undefined }))
    await actions.interactiveRebase(dialog.repoId, dialog.base, steps)
    setBusy(false)
    // also on conflicts: the operation banner takes over (continue / skip / abort)
    closeDialog()
  }

  return (
    <Modal wide title={`Interactive Rebase onto ${dialog.label}`} confirmLabel="Start Rebase" disabled={!rows || !!issue || busy} onConfirm={() => void start()}>
      {error && <div className="text-danger">{error}</div>}
      {!rows && !error && (
        <div className="flex justify-center p-4 text-muted">
          <Spinner />
        </div>
      )}
      {rows && (
        <>
          <p className="text-muted">Newest first. Squash and fixup meld a commit into the one below it (fixup discards its message).</p>
          {merges > 0 && <p className="text-warn">{merges} merge commit{merges === 1 ? '' : 's'} in this range will be flattened.</p>}
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={row.commit.hash} className="rounded border border-line bg-bg">
                <div className="flex items-center gap-2 px-2 py-1">
                  <select
                    className="h-6 rounded border border-line bg-panel px-1 outline-none focus:border-accent"
                    value={row.action}
                    onChange={(e) => update(i, { action: e.target.value as RebaseAction })}
                  >
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <code className="font-mono text-muted">{row.commit.shortHash}</code>
                  <span className={`min-w-0 flex-1 truncate ${row.action === 'drop' ? 'text-faint line-through' : ''}`}>{row.commit.subject}</span>
                  <button type="button" title="Move up (later)" className="rounded p-0.5 text-muted hover:bg-hover disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    title="Move down (earlier)"
                    className="rounded p-0.5 text-muted hover:bg-hover disabled:opacity-30"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                {row.action === 'reword' && (
                  <textarea
                    className={`${inputClass} block resize-none rounded-t-none border-x-0 border-b-0`}
                    rows={3}
                    value={row.message}
                    onChange={(e) => update(i, { message: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          {issue && <p className="text-danger">{issue}</p>}
        </>
      )}
    </Modal>
  )
}
