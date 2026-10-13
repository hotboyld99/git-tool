import { useEffect } from 'react'
import { initSession, onRepoChanged, useRepos } from './stores/repository.store'
import { subscribeProgress } from './stores/git.store'
import { useShortcuts } from './hooks/useShortcuts'
import { TitleBar } from './components/layout/TitleBar'
import { BottomPanel } from './components/layout/BottomPanel'
import { EmptyState } from './components/layout/EmptyState'
import { RepositoryTab } from './components/repository/RepositoryTab'
import { DialogHost } from './components/dialogs/DialogHost'
import { ContextMenu } from './components/common/ContextMenu'
import { ErrorToast } from './components/common/ErrorToast'

export default function App() {
  const order = useRepos((s) => s.order)
  const activeId = useRepos((s) => s.activeId)

  useEffect(() => {
    void initSession()
    const unsubscribe = [subscribeProgress(), window.repo.onChanged(onRepoChanged)]
    return () => unsubscribe.forEach((off) => off())
  }, [])
  useShortcuts()

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <main className="flex min-h-0 flex-1">
        {/* inactive tabs stay mounted (hidden) so they keep scroll position and selection */}
        {order.map((id) => (
          <div key={id} className={id === activeId ? 'flex min-w-0 flex-1' : 'hidden'}>
            <RepositoryTab id={id} />
          </div>
        ))}
        {!activeId && <EmptyState />}
      </main>
      <BottomPanel />
      <DialogHost />
      <ContextMenu />
      <ErrorToast />
    </div>
  )
}
