import { useState, type ReactNode } from 'react'
import { Check, Cloud, Folder, FolderOpen, GitBranch, Plus, Server } from 'lucide-react'
import type { GitBranch as Branch, GitRemote, RepositoryId } from '../../../shared/types'
import { getRepo, select, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openDialog, openMenu, type MenuEntry } from '../../stores/ui.store'
import { branchColor } from '../../utils/colors'
import { buildBranchTree, someLeaf, type BranchFolder, type BranchNode } from '../../utils/branchTree'
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
    {
      label: current ? `Rebase ${current} onto ${branch.name}` : 'Rebase current branch onto this',
      disabled: branch.isCurrent || !current,
      onClick: () => actions.rebase(id, branch.name)
    },
    { label: 'Create Branch Here…', onClick: () => openDialog({ type: 'createBranch', repoId: id, startPoint: branch.name, startLabel: branch.name }) },
    'separator',
    { label: 'Copy Branch Name', onClick: () => void navigator.clipboard.writeText(branch.name) }
  ]
  if (!branch.isRemote) entries.push('separator', { label: 'Delete Branch…', danger: true, disabled: branch.isCurrent, onClick: () => actions.deleteBranch(id, branch.name) })
  return entries
}

function remoteMenu(id: RepositoryId, remote: GitRemote): MenuEntry[] {
  const current = getRepo(id)?.status?.branch ?? null
  return [
    { label: `Fetch ${remote.name}`, onClick: () => void actions.fetchRemote(id, remote.name) },
    { label: current ? `Push ${current} to ${remote.name}` : 'Push current branch', disabled: !current, onClick: () => void actions.pushTo(id, remote.name) },
    'separator',
    { label: 'Edit URL…', onClick: () => openDialog({ type: 'remote', repoId: id, name: remote.name, url: remote.fetchUrl }) },
    { label: 'Copy URL', onClick: () => void navigator.clipboard.writeText(remote.fetchUrl) },
    'separator',
    { label: 'Remove Remote…', danger: true, onClick: () => actions.removeRemote(id, remote.name) }
  ]
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

type RenderLeaf = (branch: Branch, label: string, depth: number) => ReactNode

/** Folders (shared "/" prefixes) first, then the branches of this level. */
function TreeLevel({ node, depth, renderLeaf }: { node: BranchNode<Branch>; depth: number; renderLeaf: RenderLeaf }) {
  return (
    <>
      {node.folders.map((folder) => (
        <TreeFolder key={folder.path} folder={folder} depth={depth} renderLeaf={renderLeaf} />
      ))}
      {node.leaves.map((leaf) => renderLeaf(leaf.item, leaf.name, depth))}
    </>
  )
}

function TreeFolder({ folder, depth, renderLeaf }: { folder: BranchFolder<Branch>; depth: number; renderLeaf: RenderLeaf }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <SidebarItem
        icon={open ? FolderOpen : Folder}
        color={branchColor(`${folder.path}/`)}
        label={folder.name}
        title={`${folder.path}/ (${folder.count})`}
        indent={depth}
        // keeps the current branch findable while its folder is collapsed
        bold={someLeaf(folder, (b) => b.isCurrent)}
        right={<span className="text-[10px] text-faint">{folder.count}</span>}
        onClick={() => setOpen(!open)}
      />
      {open && <TreeLevel node={folder} depth={depth + 1} renderLeaf={renderLeaf} />}
    </>
  )
}

export function BranchTree({ id }: { id: RepositoryId }) {
  const { branches, remotes, selection } = useRepo(id)
  const local = branches.filter((b) => !b.isRemote)
  const isSelected = (b: Branch): boolean => selection.type === 'commit' && selection.hash === b.hash

  const localLeaf: RenderLeaf = (b, label, depth) => (
    <SidebarItem
      key={b.name}
      icon={b.isCurrent ? Check : GitBranch}
      color={branchColor(b.name)}
      label={label}
      title={b.upstream ? `${b.name} → ${b.upstream}` : b.name}
      indent={depth}
      bold={b.isCurrent}
      active={isSelected(b)}
      right={<Track track={b.track} />}
      onClick={() => select(id, { type: 'commit', hash: b.hash })}
      onDoubleClick={() => !b.isCurrent && void actions.checkout(id, b.name)}
      onContextMenu={(e) => openMenu(e, branchMenu(id, b))}
    />
  )

  const remoteLeaf: RenderLeaf = (b, label, depth) => (
    <SidebarItem
      key={b.name}
      icon={Cloud}
      color={branchColor(b.name.slice(b.name.indexOf('/') + 1))}
      label={label}
      title={b.name}
      indent={depth}
      active={isSelected(b)}
      onClick={() => select(id, { type: 'commit', hash: b.hash })}
      onDoubleClick={() => void actions.checkoutRemote(id, b.name)}
      onContextMenu={(e) => openMenu(e, branchMenu(id, b))}
    />
  )

  return (
    <>
      <SidebarSection title="Branches" count={local.length}>
        <TreeLevel node={buildBranchTree(local, (b) => b.name)} depth={0} renderLeaf={localLeaf} />
      </SidebarSection>
      <SidebarSection
        title="Remote"
        count={remotes.length}
        action={
          <button title="Add remote" className="rounded p-0.5 text-faint hover:bg-hover hover:text-fg" onClick={() => openDialog({ type: 'remote', repoId: id })}>
            <Plus size={12} />
          </button>
        }
      >
        {remotes.map((remote) => (
          <div key={remote.name}>
            <SidebarItem
              icon={Server}
              label={remote.name}
              title={`Fetch: ${remote.fetchUrl}\nPush: ${remote.pushUrl}`}
              onContextMenu={(e) => openMenu(e, remoteMenu(id, remote))}
            />
            <TreeLevel
              node={buildBranchTree(
                branches.filter((b) => b.remote === remote.name),
                (b) => b.name.slice(remote.name.length + 1)
              )}
              depth={1}
              renderLeaf={remoteLeaf}
            />
          </div>
        ))}
      </SidebarSection>
    </>
  )
}
