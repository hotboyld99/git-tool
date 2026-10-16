import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, screen, session, shell, type MenuItemConstructorOptions } from 'electron'
import { GitService } from './services/git.service'
import { RepositoryService } from './services/repository.service'
import { registerGitIpc } from './ipc/git.ipc'
import { registerRepositoryIpc } from './ipc/repository.ipc'
import { registerFilesystemIpc } from './ipc/filesystem.ipc'
import { settings } from './services/settings.service'

let mainWindow: BrowserWindow | null = null

/** Apps started from Finder / a desktop launcher don't get the login-shell PATH (Homebrew git, hook tools). */
function inheritShellPath(): void {
  if (process.platform === 'win32' || !app.isPackaged) return
  try {
    const out = execFileSync(process.env.SHELL || '/bin/sh', ['-ilc', 'printf "__PATH__%s__PATH__" "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000
    })
    const m = /__PATH__(.*)__PATH__/.exec(out)
    if (m) process.env.PATH = m[1]
  } catch {
    /* keep the default PATH */
  }
}

/** Last window size/position, ignoring a position that is no longer on any screen (monitor unplugged). */
function savedBounds(): { x?: number; y?: number; width: number; height: number } {
  const { x, y, width, height } = settings.get('window')
  if (x === undefined || y === undefined) return { width, height }
  const visible = screen.getAllDisplays().some(({ workArea: a }) => x < a.x + a.width && x + width > a.x && y < a.y + a.height && y + height > a.y)
  return visible ? { x, y, width, height } : { width, height }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...savedBounds(),
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#16191d',
    title: 'Git Tool',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.once('ready-to-show', () => {
    if (settings.get('window').maximized) mainWindow?.maximize()
    mainWindow?.show()
  })
  mainWindow.on('close', () => {
    if (!mainWindow) return
    settings.setWindow({ ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() })
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    // Chromium writes localStorage (workspace session, panel sizes) lazily; quitting right after a change would lose it
    session.defaultSession.flushStorageData()
  })
  // never navigate the app window away; open http(s) links in the system browser
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function createMenu(): void {
  // No Reload / Close entries: Cmd/Ctrl+R refreshes the repository and Cmd/Ctrl+W closes a tab.
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' } as const] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'quit' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  inheritShellPath()
  const repos = new RepositoryService()
  const git = new GitService()
  const send = (channel: string, payload: unknown): void => mainWindow?.webContents.send(channel, payload)

  registerRepositoryIpc(repos, () => mainWindow, (event) => send('repo:changed', event))
  registerGitIpc(repos, git, (event) => send('git:progress', event), () => mainWindow)
  registerFilesystemIpc(repos, () => mainWindow)

  createMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => session.defaultSession.flushStorageData())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
