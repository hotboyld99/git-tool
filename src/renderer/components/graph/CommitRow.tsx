import { memo } from 'react'
import type { GitCommit, RepositoryId } from '../../../shared/types'
import { select } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog, openMenu } from '../../stores/ui.store'
import type { GraphNode } from '../../utils/graph'
import { formatDate } from '../../utils/format'
import { GraphCanvas } from './GraphCanvas'
import { RefBadges } from './RefBadges'

export const ROW_HEIGHT = 28

interface Props {
  repoId: RepositoryId
  commit: GitCommit
  node: GraphNode
  graphWidth: number
  top: number
  selected: boolean
  remotes: string[]
  currentBranch: string | null
}

export const CommitRow = memo(function CommitRow({ repoId, commit, node, graphWidth, top, selected, remotes, currentBranch }: Props) {
  const show = (): void => select(repoId, { type: 'commit', hash: commit.hash })
  return (
    <div
      className={`absolute right-0 left-0 flex items-center ${selected ? 'bg-accent/25' : 'hover:bg-hover'}`}
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
      onClick={show}
      onDoubleClick={show}
      onContextMenu={(e) =>
        openMenu(e, [
          { label: 'Checkout Commit…', onClick: () => actions.checkoutCommit(repoId, commit.hash) },
          {
            label: 'Create Branch Here…',
            onClick: () => openDialog({ type: 'createBranch', repoId, startPoint: commit.hash, startLabel: `commit ${commit.shortHash}` })
          },
          'separator',
          { label: 'Copy Commit Hash', onClick: () => void navigator.clipboard.writeText(commit.hash) },
          { label: 'Copy Commit Message', onClick: () => void navigator.clipboard.writeText(commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject) }
        ])
      }
    >
      <div className="w-44 shrink-0 overflow-hidden px-2">
        <RefBadges refs={commit.refs} remotes={remotes} currentBranch={currentBranch} />
      </div>
      <GraphCanvas node={node} width={graphWidth} height={ROW_HEIGHT} />
      <div className={`min-w-0 flex-1 truncate pl-2 ${node.isMerge ? 'text-muted' : ''}`}>{commit.subject}</div>
      <div className="w-36 shrink-0 truncate px-2 text-muted">{commit.authorName}</div>
      <div className="w-32 shrink-0 px-2 font-mono text-[11px] text-muted">{formatDate(commit.date)}</div>
    </div>
  )
})
