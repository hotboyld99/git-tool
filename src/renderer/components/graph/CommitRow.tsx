import { memo, useState } from 'react'
import { Archive, Pencil } from 'lucide-react'
import type { GitCommit, RepositoryId } from '../../../shared/types'
import { getRepo, select, type Selection } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog, openMenu, type MenuEntry } from '../../stores/ui.store'
import type { GraphNode, GraphRow } from '../../utils/graph'
import { formatDate } from '../../utils/format'
import { stashMenu } from '../stash/StashList'
import { Avatar } from './Avatar'
import { GraphCanvas, laneX } from './GraphCanvas'
import { Badge, RefBadges } from './RefBadges'

export const ROW_HEIGHT = 36
const AVATAR_SIZE = 20

interface Props {
  repoId: RepositoryId
  row: GraphRow
  node: GraphNode
  graphWidth: number
  top: number
  selected: boolean
  remotes: string[]
  currentBranch: string | null
}

function commitMenu(repoId: RepositoryId, commit: GitCommit): MenuEntry[] {
  const status = getRepo(repoId)?.status
  const isHead = status?.head === commit.hash
  const busy = !!status?.operation
  const label = `commit ${commit.shortHash}`
  return [
    { label: 'Checkout Commit…', disabled: isHead, onClick: () => actions.checkoutCommit(repoId, commit.hash) },
    { label: 'Create Branch Here…', onClick: () => openDialog({ type: 'createBranch', repoId, startPoint: commit.hash, startLabel: label }) },
    { label: 'Create Tag Here…', onClick: () => openDialog({ type: 'createTag', repoId, hash: commit.hash, label }) },
    'separator',
    { label: 'Cherry Pick Commit', disabled: isHead, onClick: () => void actions.cherryPick(repoId, commit.hash) },
    { label: 'Revert Commit…', onClick: () => actions.revert(repoId, commit.hash) },
    {
      label: 'Interactive Rebase onto Here…',
      disabled: isHead || busy,
      onClick: () => openDialog({ type: 'interactiveRebase', repoId, base: commit.hash, label })
    },
    {
      label: `Reset ${status?.branch ?? 'HEAD'} to Here…`,
      disabled: isHead,
      onClick: () => openDialog({ type: 'reset', repoId, hash: commit.hash, label, branch: status?.branch ?? 'HEAD' })
    },
    'separator',
    { label: 'Start Bisect (this is good, HEAD is bad)', disabled: isHead || busy, onClick: () => void actions.bisectStart(repoId, commit.hash) },
    'separator',
    { label: 'Copy Commit Hash', onClick: () => void navigator.clipboard.writeText(commit.hash) },
    { label: 'Copy Commit Message', onClick: () => void navigator.clipboard.writeText(commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject) }
  ]
}

export const rowSelection = (row: GraphRow): Selection =>
  row.kind === 'wip' ? { type: 'changes' } : row.kind === 'stash' ? { type: 'stash', ref: row.stash.ref, hash: row.stash.hash } : { type: 'commit', hash: row.commit.hash }

const WIP_COLOR = '#94a3b8'

export const CommitRow = memo(function CommitRow({ repoId, row, node, graphWidth, top, selected, remotes, currentBranch }: Props) {
  const [hovered, setHovered] = useState(false)
  const { commit } = row
  const show = (): void => select(repoId, rowSelection(row))
  const menu = row.kind === 'commit' ? commitMenu(repoId, commit) : row.kind === 'stash' ? stashMenu(repoId, row.stash) : null
  return (
    <div
      className={`absolute right-0 left-0 flex items-center ${selected ? 'bg-accent/25' : 'hover:bg-hover'}`}
      style={{ height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
      onClick={show}
      onDoubleClick={show}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        show()
        if (menu) openMenu(e, menu)
      }}
    >
      <div className="flex w-44 shrink-0 overflow-hidden px-2">
        {row.kind === 'commit' && <RefBadges refs={commit.refs} remotes={remotes} currentBranch={currentBranch} />}
        {row.kind === 'wip' && (
          <Badge color={WIP_COLOR}>
            <Pencil size={11} className="shrink-0" />
            WIP
          </Badge>
        )}
        {row.kind === 'stash' && (
          <Badge color={node.color} title={`${row.stash.ref} on ${row.stash.branch}`}>
            <Archive size={11} className="shrink-0" />
            <span className="truncate">{row.stash.ref}</span>
          </Badge>
        )}
      </div>
      <div className="relative shrink-0">
        <GraphCanvas node={node} width={graphWidth} height={ROW_HEIGHT} highlight={hovered || selected} kind={row.kind} />
        {row.kind === 'commit' && !node.isMerge && (
          <div className="absolute" style={{ left: laneX(node.lane) - AVATAR_SIZE / 2, top: (ROW_HEIGHT - AVATAR_SIZE) / 2 }}>
            <Avatar name={commit.authorName} email={commit.authorEmail} size={AVATAR_SIZE} ring={node.color} highlight={hovered || selected} />
          </div>
        )}
      </div>
      <div className={`min-w-0 flex-1 truncate pl-3 text-[13px] ${node.isMerge ? 'text-muted' : ''} ${row.kind === 'commit' ? '' : 'text-muted italic'}`}>
        {commit.subject}
      </div>
      <div className="w-36 shrink-0 truncate px-2 text-muted">{commit.authorName}</div>
      <div className="w-32 shrink-0 px-2 font-mono text-[11px] text-muted">{formatDate(commit.date)}</div>
    </div>
  )
})
