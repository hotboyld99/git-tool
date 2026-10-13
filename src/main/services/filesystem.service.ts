import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { shell } from 'electron'
import type { ChangeScope } from '../../shared/types'

/** Resolves a repository-relative path and refuses anything that escapes the repository. */
export function resolveInside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const r = relative(root, full)
  if (!rel || r.startsWith('..') || isAbsolute(r)) throw new Error('Path is outside the repository.')
  return full
}

export async function openFile(root: string, rel: string): Promise<void> {
  const error = await shell.openPath(resolveInside(root, rel))
  if (error) throw new Error(error)
}

export function revealFile(root: string, rel: string): void {
  shell.showItemInFolder(resolveInside(root, rel))
}

/** VS Code's URL handler works on every OS without the `code` CLI being on PATH. */
export async function openInEditor(root: string, rel?: string, line?: number): Promise<void> {
  const full = rel ? resolveInside(root, rel) : root
  await shell.openExternal(`vscode://file${pathToFileURL(full).pathname}${line ? `:${line}` : ''}`)
}

export async function openFolder(root: string): Promise<void> {
  const error = await shell.openPath(root)
  if (error) throw new Error(error)
}

/** Launches a detached terminal; resolves with false when the program does not exist. */
function launch(command: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, detached: true, stdio: 'ignore' })
    child.once('error', () => done(false))
    child.once('spawn', () => {
      child.unref()
      done(true)
    })
  })
}

/** Opens the system terminal in the repository folder (no shell command line is built from the path). */
export async function openTerminal(root: string): Promise<void> {
  const candidates: [string, string[]][] =
    process.platform === 'darwin'
      ? [['open', ['-a', 'Terminal', root]]]
      : process.platform === 'win32'
        ? [['cmd.exe', ['/c', 'start', 'cmd.exe']]] // `start` opens the new window in cwd
        : [['x-terminal-emulator', []], ['gnome-terminal', []], ['konsole', []], ['xfce4-terminal', []], ['xterm', []]]
  for (const [command, args] of candidates) {
    if (await launch(command, args, root)) return
  }
  throw new Error('No terminal application found.')
}

const GIT_DIR = /^\.git([\\/]|$)/
const GIT_REFS = /^\.git[\\/](HEAD|ORIG_HEAD|MERGE_HEAD|packed-refs|refs([\\/]|$))/
const GIT_INDEX = /^\.git[\\/]index$/

/** Classifies a changed path (relative to the repository root); null = irrelevant. */
export function changeScope(file: string): ChangeScope | null {
  if (file.endsWith('.lock')) return null
  if (GIT_REFS.test(file)) return 'refs'
  if (GIT_INDEX.test(file)) return 'worktree'
  if (GIT_DIR.test(file)) return null // objects, logs, FETCH_HEAD...
  return 'worktree'
}

/**
 * Watches the working tree and .git/{HEAD,index,refs} with one native recursive watcher,
 * debounced so bursts (checkout, npm install) trigger a single refresh.
 * ponytail: on Linux recursive fs.watch uses one inotify watch per directory; huge trees can hit
 * fs.inotify.max_user_watches — switch to a gitignore-aware watcher if that shows up.
 */
export function watchRepository(root: string, onChange: (scopes: ChangeScope[]) => void, delay = 400): () => void {
  const pending = new Set<ChangeScope>()
  let timer: NodeJS.Timeout | undefined
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    const scope = filename ? changeScope(filename.toString()) : 'refs'
    if (!scope) return
    pending.add(scope)
    clearTimeout(timer)
    timer = setTimeout(() => {
      onChange([...pending])
      pending.clear()
    }, delay)
  })
  watcher.on('error', () => watcher.close()) // e.g. repository folder deleted
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}
