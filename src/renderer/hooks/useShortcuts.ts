import { useEffect } from 'react'
import { closeRepository, openRepositoryDialog, refreshAll, useRepos } from '../stores/repository.store'
import { actions } from '../stores/git.store'

export function useShortcuts(): void {
  useEffect(() => {
    const mac = window.system.platform === 'darwin'
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(mac ? e.metaKey : e.ctrlKey) || e.altKey) return
      const id = useRepos.getState().activeId
      const key = e.key.toLowerCase()
      const shortcut = e.shiftKey
        ? { f: actions.fetch, p: actions.push, l: actions.pull }[key]
        : { enter: actions.commit, r: refreshAll, w: closeRepository }[key]
      if (!e.shiftKey && key === 'o') {
        e.preventDefault()
        void openRepositoryDialog()
      } else if (shortcut && id) {
        e.preventDefault()
        void shortcut(id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
