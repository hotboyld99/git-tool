import { FileDiff } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { select, useRepo } from '../../stores/repository.store'
import { BranchTree } from '../branches/BranchTree'
import { StashList } from '../stash/StashList'
import { TagList } from '../branches/TagList'
import { LfsSection, SubmoduleList, WorktreeList } from './WorkspaceExtras'
import { SidebarItem, SidebarSection } from './SidebarSection'

export function RepositorySidebar({ id }: { id: RepositoryId }) {
  const { status, selection } = useRepo(id)
  const changes = status ? status.stagedFiles.length + status.unstagedFiles.length + status.conflictedFiles.length : 0
  return (
    <div className="h-full overflow-y-auto bg-panel py-2">
      <SidebarSection title="Workspace">
        <SidebarItem
          icon={FileDiff}
          label="Changes"
          active={selection.type === 'changes'}
          onClick={() => select(id, { type: 'changes' })}
          right={changes > 0 && <span className="rounded-full bg-warn/20 px-1.5 text-[10px] text-warn">{changes}</span>}
        />
      </SidebarSection>
      <BranchTree id={id} />
      <TagList id={id} />
      <StashList id={id} />
      <WorktreeList id={id} />
      <SubmoduleList id={id} />
      <LfsSection id={id} />
    </div>
  )
}
