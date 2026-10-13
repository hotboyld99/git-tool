import { FolderGit2, FolderOpen } from 'lucide-react'
import { openRepositoryDialog, openRepositoryPath, useRepos } from '../../stores/repository.store'
import { Button } from '../common/Button'

export function EmptyState() {
  const recent = useRepos((s) => s.recent)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <FolderGit2 size={44} strokeWidth={1.4} className="text-accent" />
      <div className="text-base font-medium">Open a Git repository</div>
      <Button variant="primary" onClick={() => void openRepositoryDialog()}>
        <FolderOpen size={14} /> Open Repository
      </Button>
      {recent.length > 0 && (
        <div className="mt-4 w-[420px]">
          <div className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-faint uppercase">Recent repositories</div>
          {recent.map((path) => (
            <button key={path} className="block w-full rounded px-2 py-1.5 text-left hover:bg-hover" onClick={() => void openRepositoryPath(path)}>
              <div className="font-medium">{path.split(/[\\/]/).pop()}</div>
              <div className="truncate text-[11px] text-muted">{path}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
