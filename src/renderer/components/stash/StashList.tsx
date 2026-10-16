import { Archive } from 'lucide-react'
import type { GitStash, RepositoryId } from '../../../shared/types'
import { select, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openMenu, type MenuEntry } from '../../stores/ui.store'
import { SidebarItem, SidebarSection } from '../repository/SidebarSection'

export function stashMenu(id: RepositoryId, stash: GitStash): MenuEntry[] {
  return [
    { label: 'Apply', onClick: () => void actions.stashApply(id, stash.ref) },
    { label: 'Pop', onClick: () => void actions.stashPop(id, stash.ref) },
    { label: 'View', onClick: () => select(id, { type: 'stash', ref: stash.ref, hash: stash.hash }) },
    'separator',
    { label: 'Drop…', danger: true, onClick: () => actions.stashDrop(id, stash.ref) }
  ]
}

export function StashList({ id }: { id: RepositoryId }) {
  const { stashes, selection } = useRepo(id)
  return (
    <SidebarSection title="Stashes" count={stashes.length}>
      {stashes.map((s) => (
        <SidebarItem
          key={s.hash}
          icon={Archive}
          label={
            <>
              <span className="text-faint">{s.ref}</span> {s.message}
            </>
          }
          title={`${s.ref} on ${s.branch}: ${s.message}`}
          active={selection.type === 'stash' && selection.ref === s.ref}
          onClick={() => select(id, { type: 'stash', ref: s.ref, hash: s.hash })}
          onContextMenu={(e) => openMenu(e, stashMenu(id, s))}
        />
      ))}
    </SidebarSection>
  )
}
