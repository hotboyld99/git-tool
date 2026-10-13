import type { RepositoryId } from '../../../shared/types'
import { useRepo } from '../../stores/repository.store'
import { setUi, useUi } from '../../stores/ui.store'
import { ResizeHandle } from '../common/ResizeHandle'
import { Toolbar } from '../layout/Toolbar'
import { CommitGraph } from '../graph/CommitGraph'
import { DiffViewer } from '../diff/DiffViewer'
import { ChangesPanel } from '../changes/ChangesPanel'
import { CommitDetail } from '../commit/CommitDetail'
import { RepositorySidebar } from './RepositorySidebar'
import { OperationBanner } from './OperationBanner'

export function RepositoryTab({ id }: { id: RepositoryId }) {
  const { selection, selectedFile } = useRepo(id)
  const sidebarWidth = useUi((s) => s.sidebarWidth)
  const detailWidth = useUi((s) => s.detailWidth)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Toolbar id={id} />
      <OperationBanner id={id} />
      <div className="flex min-h-0 flex-1">
        <div className="shrink-0" style={{ width: sidebarWidth }}>
          <RepositorySidebar id={id} />
        </div>
        <ResizeHandle value={sidebarWidth} min={180} max={480} onChange={(v) => setUi({ sidebarWidth: v })} />
        <div className="relative min-w-0 flex-1">
          {/* the graph stays mounted under the diff so its scroll position survives */}
          <div className={selectedFile ? 'invisible h-full' : 'h-full'}>
            <CommitGraph id={id} />
          </div>
          {selectedFile && (
            <div className="absolute inset-0">
              <DiffViewer id={id} file={selectedFile} />
            </div>
          )}
        </div>
        <ResizeHandle value={detailWidth} min={300} max={800} invert onChange={(v) => setUi({ detailWidth: v })} />
        <div className="shrink-0" style={{ width: detailWidth }}>
          {selection.type === 'changes' ? <ChangesPanel id={id} /> : <CommitDetail id={id} selection={selection} />}
        </div>
      </div>
    </div>
  )
}
