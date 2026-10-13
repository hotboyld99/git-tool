import type { RepositoryId } from '../../../shared/types'
import { patchRepo, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'

export function CommitPanel({ id }: { id: RepositoryId }) {
  const { status, commitMessage, loading } = useRepo(id)
  const staged = status?.stagedFiles.length ?? 0
  const unstaged = status?.unstagedFiles.length ?? 0
  const canCommit = commitMessage.trim() !== '' && staged + unstaged > 0 && !loading.committing

  return (
    <div className="space-y-2 border-t border-line p-3">
      <textarea
        value={commitMessage}
        onChange={(e) => patchRepo(id, { commitMessage: e.target.value })}
        placeholder="Commit message"
        rows={4}
        className="w-full resize-none rounded border border-line bg-bg px-2 py-1.5 outline-none placeholder:text-faint focus:border-accent"
      />
      <Button variant="primary" className="w-full" disabled={!canCommit} title="Commit (Ctrl/⌘+Enter)" onClick={() => void actions.commit(id)}>
        {loading.committing && <Spinner size={12} />}
        {staged === 0 ? 'Stage All & Commit' : `Commit ${staged} file${staged === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
