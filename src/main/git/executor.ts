import { spawn } from 'node:child_process'
import type { GitError } from '../../shared/types'

export interface RunOptions {
  /** label shown to the user, defaults to the git subcommand */
  operation?: string
  /** ms; 0 disables. Network operations should rely on cancel instead. */
  timeout?: number
  signal?: AbortSignal
  /** streamed stdout/stderr chunks (progress) */
  onOutput?: (chunk: string) => void
  /** exit codes treated as success, e.g. [0, 1] for `diff --no-index` */
  okExitCodes?: number[]
  /** overrides the configured Git executable (used to verify a candidate before saving it) */
  executable?: string
  /** extra environment, e.g. GIT_EDITOR / GIT_SEQUENCE_EDITOR (env wins over the user's config and env) */
  env?: Record<string, string>
}

export class GitCommandError extends Error {
  constructor(public readonly info: GitError) {
    super(info.stderr.trim() || `${info.operation} failed`)
  }
}

const BASE_ARGS = ['-c', 'core.quotePath=false', '-c', 'color.ui=false']

let gitExecutable = 'git'

/** null restores `git` from PATH */
export function setGitExecutable(path: string | null): void {
  gitExecutable = path ?? 'git'
}

export const getGitExecutable = (): string => gitExecutable

const env = (): NodeJS.ProcessEnv => ({
  ...process.env,
  // never block on an interactive terminal prompt; credential helpers / ssh-agent still work
  GIT_TERMINAL_PROMPT: '0',
  // read-only commands (status) must not rewrite .git/index, otherwise the watcher loops
  GIT_OPTIONAL_LOCKS: '0',
  // stable English messages so errors like "no upstream" can be detected
  LC_ALL: 'C',
  LANG: 'C',
  // merge/pull must never open an editor for the merge message
  GIT_MERGE_AUTOEDIT: 'no'
})

export function runGit(cwd: string, args: string[], options: RunOptions = {}): Promise<string> {
  const { operation = args[0] ?? 'git', timeout = 120_000, signal, onOutput, okExitCodes = [0], executable = gitExecutable, env: extraEnv } = options
  const command = `git ${args.join(' ')}`
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...BASE_ARGS, ...args], { cwd, env: { ...env(), ...extraEnv }, windowsHide: true, signal })
    const out: Buffer[] = []
    const err: Buffer[] = []
    let settled = false
    const timer = timeout > 0 ? setTimeout(() => child.kill(), timeout) : undefined

    const fail = (exitCode: number, stderr: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new GitCommandError({ operation, exitCode, stdout: Buffer.concat(out).toString('utf8'), stderr, command }))
    }

    child.stdout.on('data', (chunk: Buffer) => {
      out.push(chunk)
      onOutput?.(chunk.toString('utf8'))
    })
    child.stderr.on('data', (chunk: Buffer) => {
      err.push(chunk)
      onOutput?.(chunk.toString('utf8'))
    })
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (e.name === 'AbortError') fail(-1, 'Operation cancelled.')
      else if (e.code === 'ENOENT') fail(-1, 'Git executable not found. Please install Git and make sure it is on PATH.')
      else fail(-1, e.message)
    })
    child.on('close', (code) => {
      if (settled) return
      const stderr = Buffer.concat(err).toString('utf8')
      if (code === null) return fail(-1, signal?.aborted ? 'Operation cancelled.' : `Timed out after ${timeout}ms.\n${stderr}`)
      if (!okExitCodes.includes(code)) return fail(code, stderr)
      settled = true
      clearTimeout(timer)
      if (process.env.NODE_ENV === 'development') console.debug(`[git] ${command} (${Date.now() - started}ms)`)
      resolve(Buffer.concat(out).toString('utf8'))
    })
  })
}

export function toGitError(e: unknown, operation: string): GitError {
  if (e instanceof GitCommandError) return e.info
  return { operation, exitCode: -1, stdout: '', stderr: e instanceof Error ? e.message : String(e) }
}
