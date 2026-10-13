import { Tag } from 'lucide-react'
import type { RepositoryId } from '../../../shared/types'
import { select, useRepo } from '../../stores/repository.store'
import { actions } from '../../stores/git.store'
import { openMenu } from '../../stores/ui.store'
import { SidebarItem, SidebarSection } from '../repository/SidebarSection'

export function TagList({ id }: { id: RepositoryId }) {
  const { tags, selection } = useRepo(id)
  return (
    <SidebarSection title="Tags" count={tags.length}>
      {tags.map((t) => (
        <SidebarItem
          key={t.name}
          icon={Tag}
          color="#facc15"
          label={t.name}
          title={t.message ? `${t.name}: ${t.message}` : t.name}
          active={selection.type === 'commit' && selection.hash === t.hash}
          onClick={() => select(id, { type: 'commit', hash: t.hash })}
          onContextMenu={(e) =>
            openMenu(e, [
              { label: 'Push Tag', onClick: () => void actions.pushTag(id, t.name) },
              { label: 'Copy Tag Name', onClick: () => void navigator.clipboard.writeText(t.name) },
              'separator',
              { label: 'Delete Tag…', danger: true, onClick: () => actions.deleteTag(id, t.name) }
            ])
          }
        />
      ))}
    </SidebarSection>
  )
}
