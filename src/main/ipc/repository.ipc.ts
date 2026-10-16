import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { dialog, type BrowserWindow } from 'electron'
import type { OpenResult, RepoChangedEvent, RepositoryInfo, Session } from '../../shared/types'
import { runGit } from '../git/executor'
import { RepositoryService } from '../services/repository.service'
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

  // folders the user picked in the native dialog that are not repositories: only these may be `git init`-ed
  // (paths sent by the renderer, e.g. from the recent list, never qualify)
  const initAllowed = new Set<string>()

  const tryOpen = async (folder: string, picked: boolean): Promise<OpenResult> => {
    const path = resolve(folder)
    if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`Folder not found: ${path}`)
    if (RepositoryService.isRepository(path)) return { repo: open(path) }
    // a sub folder of a repository was picked: offer its root
    const root = await runGit(path, ['rev-parse', '--show-toplevel']).then(
      (out) => resolve(out.trim()),
      () => null
    )
    if (picked) initAllowed.add(path)
    return { notRepository: { path, root, canInit: picked } }
  }

  handle('repo:openDialog', async () => {
    const win = getWindow()
    const options = { title: 'Open Repository', properties: ['openDirectory' as const, 'createDirectory' as const] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled || !result.filePaths[0] ? null : tryOpen(result.filePaths[0], true)
  })

  handle('repo:open', (folder) => tryOpen(str(folder), false))

  handle('repo:init', async (folder) => {
    const path = resolve(str(folder))
    if (!initAllowed.has(path)) throw new Error('Only a folder you just picked can be initialized.')
    await runGit(path, ['init'])
    initAllowed.delete(path)
    return open(path)
  })

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
