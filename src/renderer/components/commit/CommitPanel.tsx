import type { RepositoryId } from '../../../shared/types'
import { patchRepo, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'

export function CommitPanel({ id }: { id: RepositoryId }) {
  const { status, commitMessage, loading, amend } = useRepo(id)
  const staged = status?.stagedFiles.length ?? 0
  const unstaged = status?.unstagedFiles.length ?? 0
  const hasCommits = !!status?.head
  const canCommit = commitMessage.trim() !== '' && (amend || staged + unstaged > 0) && !loading.committing
  // nothing ahead of the upstream = HEAD is already on the remote
  const amendsPushedCommit = amend && !!status?.upstream && status.ahead === 0

  const label = amend ? 'Amend Last Commit' : staged === 0 ? 'Stage All & Commit' : `Commit ${staged} file${staged === 1 ? '' : 's'}`

  return (
    <div className="space-y-2 border-t border-line p-3">
      <textarea
        value={commitMessage}
        onChange={(e) => patchRepo(id, { commitMessage: e.target.value })}
        placeholder="Commit message"
        rows={4}
        className="w-full resize-none rounded border border-line bg-bg px-2 py-1.5 outline-none placeholder:text-faint focus:border-accent"
      />
      <label className={`flex items-center gap-2 ${hasCommits ? '' : 'opacity-40'}`}>
        <input type="checkbox" disabled={!hasCommits} checked={amend} onChange={(e) => void actions.setAmend(id, e.target.checked)} />
        Amend last commit
      </label>
      {amendsPushedCommit && (
        <p className="text-[11px] leading-snug text-warn">The last commit is already pushed. Amending rewrites it and will require a force push.</p>
      )}
      <Button variant="primary" className="w-full" disabled={!canCommit} title="Commit (Ctrl/⌘+Enter)" onClick={() => void actions.commit(id)}>
        {loading.committing && <Spinner size={12} />}
        {label}
      </Button>
    </div>
  )
}
