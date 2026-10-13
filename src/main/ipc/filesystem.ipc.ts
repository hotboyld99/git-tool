import { app, dialog, type BrowserWindow } from 'electron'
import type { AppSettings } from '../../shared/types'
import { runGit, setGitExecutable } from '../git/executor'
import type { RepositoryService } from '../services/repository.service'
import { openFile, openFolder, openInEditor, openTerminal, revealFile } from '../services/filesystem.service'
import { settings } from '../services/settings.service'
import { handle, int, str } from './handle'

async function currentSettings(): Promise<AppSettings> {
  const gitVersion = await runGit(app.getPath('home'), ['--version']).then(
    (v) => v.trim(),
    () => 'Git not found'
  )
  return { gitPath: settings.get('gitPath'), gitVersion }
}

export function registerFilesystemIpc(repos: RepositoryService, getWindow: () => BrowserWindow | null): void {
  setGitExecutable(settings.get('gitPath'))
  const root = (id: unknown): string => repos.get(id).path

  handle('system:openFile', (id, file) => openFile(root(id), str(file)))
  handle('system:reveal', (id, file) => revealFile(root(id), str(file)))
  handle('system:openInEditor', (id, file, line) =>
    openInEditor(root(id), file === undefined ? undefined : str(file), line === undefined ? undefined : int(line, 1, 1e9))
  )
  handle('system:openTerminal', (id) => openTerminal(root(id)))
  handle('system:openFolder', (id) => openFolder(root(id)))

  handle('system:settings', currentSettings)

  // The executable path is only ever chosen through the native picker in this process,
  // so a compromised renderer cannot point the app at an arbitrary program.
  handle('system:pickGitExecutable', async () => {
    const win = getWindow()
    const options = { title: 'Choose Git executable', properties: ['openFile' as const, 'showHiddenFiles' as const] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    const version = await runGit(app.getPath('home'), ['--version'], { executable: path }).catch(() => '')
    if (!version.startsWith('git version')) throw new Error(`"${path}" is not a Git executable.`)
    settings.setGitPath(path)
    setGitExecutable(path)
    return currentSettings()
  })

  handle('system:resetGitExecutable', () => {
    settings.setGitPath(null)
    setGitExecutable(null)
    return currentSettings()
  })
}
