import { Check, Cloud, GitBranch, Server } from 'lucide-react'
import type { GitBranch as Branch, RepositoryId } from '../../../shared/types'
import { getRepo, select, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog, openMenu, type MenuEntry } from '../../stores/ui.store'
import { branchColor } from '../../utils/colors'
import { SidebarItem, SidebarSection } from '../repository/SidebarSection'

function branchMenu(id: RepositoryId, branch: Branch): MenuEntry[] {
  const current = getRepo(id)?.status?.branch ?? null
  const entries: MenuEntry[] = [
    {
      label: branch.isRemote ? `Checkout ${branch.name}` : 'Checkout',
      disabled: branch.isCurrent,
      onClick: () => void (branch.isRemote ? actions.checkoutRemote(id, branch.name) : actions.checkout(id, branch.name))
    },
    {
      label: current ? `Merge into ${current}` : 'Merge into current branch',
      disabled: branch.isCurrent || !current,
      onClick: () => actions.merge(id, branch.name)
    },
    { label: 'Create Branch Here…', onClick: () => openDialog({ type: 'createBranch', repoId: id, startPoint: branch.name, startLabel: branch.name }) },
    'separator',
    { label: 'Copy Branch Name', onClick: () => void navigator.clipboard.writeText(branch.name) }
  ]
  if (!branch.isRemote) entries.push('separator', { label: 'Delete Branch…', danger: true, disabled: branch.isCurrent, onClick: () => actions.deleteBranch(id, branch.name) })
  return entries
}

/** "ahead 1, behind 2" -> "↑1 ↓2" */
function Track({ track }: { track?: string }) {
  if (!track || track === 'gone') return track ? <span className="text-[10px] text-faint">gone</span> : null
  const ahead = /ahead (\d+)/.exec(track)?.[1]
  const behind = /behind (\d+)/.exec(track)?.[1]
  return (
    <span className="font-mono text-[10px] text-muted">
      {ahead && `↑${ahead}`} {behind && `↓${behind}`}
    </span>
  )
}

export function BranchTree({ id }: { id: RepositoryId }) {
  const { branches, remotes, selection } = useRepo(id)
  const local = branches.filter((b) => !b.isRemote)
  const isSelected = (b: Branch): boolean => selection.type === 'commit' && selection.hash === b.hash

  return (
    <>
      <SidebarSection title="Branches" count={local.length}>
        {local.map((b) => (
          <SidebarItem
            key={b.name}
            icon={b.isCurrent ? Check : GitBranch}
            color={branchColor(b.name)}
            label={b.name}
            title={b.upstream ? `${b.name} → ${b.upstream}` : b.name}
            bold={b.isCurrent}
            active={isSelected(b)}
            right={<Track track={b.track} />}
            onClick={() => select(id, { type: 'commit', hash: b.hash })}
            onDoubleClick={() => !b.isCurrent && void actions.checkout(id, b.name)}
            onContextMenu={(e) => openMenu(e, branchMenu(id, b))}
          />
        ))}
      </SidebarSection>
      <SidebarSection title="Remote" count={remotes.length}>
        {remotes.map((remote) => (
          <div key={remote.name}>
            <SidebarItem icon={Server} label={remote.name} title={`Fetch: ${remote.fetchUrl}\nPush: ${remote.pushUrl}`} />
            {branches
              .filter((b) => b.remote === remote.name)
              .map((b) => {
                const short = b.name.slice(remote.name.length + 1)
                return (
                  <SidebarItem
                    key={b.name}
                    indent={1}
                    icon={Cloud}
                    color={branchColor(short)}
                    label={short}
                    title={b.name}
                    active={isSelected(b)}
                    onClick={() => select(id, { type: 'commit', hash: b.hash })}
                    onDoubleClick={() => void actions.checkoutRemote(id, b.name)}
                    onContextMenu={(e) => openMenu(e, branchMenu(id, b))}
                  />
                )
              })}
          </div>
        ))}
      </SidebarSection>
    </>
  )
}
