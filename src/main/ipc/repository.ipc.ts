import { dialog, type BrowserWindow } from 'electron'
import type { RepoChangedEvent, RepositoryInfo, Session } from '../../shared/types'
import type { RepositoryService } from '../services/repository.service'
import { settings } from '../services/settings.service'
import { watchRepository } from '../services/filesystem.service'
import { handle, str } from './handle'

export function registerRepositoryIpc(
  repos: RepositoryService,
  getWindow: () => BrowserWindow | null,
  sendChanged: (event: RepoChangedEvent) => void
): void {
  const watchers = new Map<string, () => void>()
  const persistOpened = (): void => settings.setOpened(repos.list().map((r) => r.path))

  const open = (folder: string, addRecent = true): RepositoryInfo => {
    const repo = repos.register(folder)
    if (!watchers.has(repo.id)) {
      watchers.set(repo.id, watchRepository(repo.path, (scopes) => sendChanged({ repoId: repo.id, scopes })))
    }
    if (addRecent) settings.addRecent(repo.path)
    persistOpened()
    return repo
  }

  handle('repo:openDialog', async () => {
    const win = getWindow()
    const options = { title: 'Open Repository', properties: ['openDirectory' as const] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled || !result.filePaths[0] ? null : open(result.filePaths[0])
  })

  handle('repo:open', (folder) => open(str(folder)))

  handle('repo:close', (id) => {
    const repo = repos.get(id)
    watchers.get(repo.id)?.()
    watchers.delete(repo.id)
    repos.unregister(repo.id)
    persistOpened()
  })

  handle('repo:setActive', (id) => settings.setActive(id === null ? null : repos.get(id).path))

  handle('repo:session', (): Session => {
    // re-open what was open last time, silently skipping folders that are gone
    for (const path of settings.get('openedRepositories')) {
      try {
        open(path, false)
      } catch {
        /* folder moved or deleted */
      }
    }
    const opened = repos.list()
    const activePath = settings.get('activeRepository')
    return {
      opened,
      activeId: opened.find((r) => r.path === activePath)?.id ?? opened[0]?.id ?? null,
      recent: settings.get('recentRepositories')
    }
  })
}
