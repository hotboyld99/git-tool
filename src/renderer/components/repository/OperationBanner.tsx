import { AlertTriangle, Search } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { select, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'

const button = 'rounded border border-current/40 px-2 py-0.5 hover:bg-current/15 disabled:opacity-40'

const LABEL = { merge: 'Merge', 'cherry-pick': 'Cherry-pick', revert: 'Revert', rebase: 'Rebase', bisect: 'Bisect' }

/** Shown under the toolbar while a merge / cherry-pick / revert / rebase / bisect waits for the user. */
export function OperationBanner({ id }: { id: RepositoryId }) {
  const { status, bisectMessage } = useRepo(id)
  const operation = status?.operation
  if (!status || !operation) return null
  const conflicts = status.conflictedFiles.length

  if (operation === 'bisect') {
    const found = /^([0-9a-f]{7,64}) is the first bad commit/.exec(bisectMessage)
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-accent/30 bg-accent/10 px-3 py-1.5 text-accent">
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={bisectMessage}>
          {found
            ? `Found it: ${found[1].slice(0, 7)} is the first bad commit.`
            : `Bisect — test the checked-out commit (${status.head.slice(0, 7)}), then mark it. ${bisectMessage.split('\n')[0]}`}
        </span>
        {found ? (
          <button className={button} onClick={() => select(id, { type: 'commit', hash: found[1] })}>
            Show Commit
          </button>
        ) : (
          <>
            <button className={button} onClick={() => void actions.bisectMark(id, 'good')}>
              Good
            </button>
            <button className={button} onClick={() => void actions.bisectMark(id, 'bad')}>
              Bad
            </button>
            <button className={button} onClick={() => void actions.bisectMark(id, 'skip')}>
              Skip
            </button>
          </>
        )}
        <button className={button} onClick={() => actions.abortOperation(id)}>
          {found ? 'Finish' : 'Stop'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-warn/30 bg-warn/10 px-3 py-1.5 text-warn">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">
        {LABEL[operation]} in progress —{' '}
        {conflicts > 0
          ? `resolve ${conflicts} conflict${conflicts === 1 ? '' : 's'}, then ${operation === 'rebase' ? 'continue' : 'commit'}.`
          : operation === 'rebase'
            ? 'continue to replay the next commit.'
            : 'commit to finish.'}
      </span>
      {operation === 'rebase' && (
        <>
          <button className={button} disabled={conflicts > 0} onClick={() => void actions.rebaseContinue(id)}>
            Continue
          </button>
          <button className={button} onClick={() => actions.rebaseSkip(id)}>
            Skip
          </button>
        </>
      )}
      <button className={button} onClick={() => actions.abortOperation(id)}>
        Abort
      </button>
    </div>
  )
}
