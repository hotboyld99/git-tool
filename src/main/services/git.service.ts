import type { ChangedFile, DiffRequest, FileDiff, GitBranch, GitCommit, GitRemote, GitStash, GitStatus } from '../../shared/types'
import { GitCommandError, runGit } from '../git/executor'
import { STATUS_ARGS, parseStatus } from '../git/status'
import { BRANCH_ARGS, parseBranches } from '../git/branch'
import { logArgs, parseLog } from '../git/log'
import { parseDiff } from '../git/diff'
import { commitFilesArgs, parseNameStatus } from '../git/commit'
import { parseRemotes } from '../git/remote'
import { STASH_LIST_ARGS, parseStashes } from '../git/stash'

type Output = (text: string) => void

function assertRef(name: string): string {
  if (!name || name.startsWith('-') || /[\s\0]/.test(name)) throw new Error(`Invalid ref name: "${name}"`)
  return name
}

function assertHash(hash: string): string {
  if (!/^[0-9a-f]{4,64}$/i.test(hash)) throw new Error(`Invalid commit hash: "${hash}"`)
  return hash
}

function assertStash(ref: string): string {
  if (!/^stash@\{\d+\}$/.test(ref)) throw new Error(`Invalid stash: "${ref}"`)
  return ref
}

function assertFiles(files: string[]): string[] {
  if (files.length === 0) throw new Error('No files selected.')
  return files
}

/** Runs `primary`; on Git versions that lack the subcommand (switch/restore < 2.23) runs `fallback`. */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary()
  } catch (e) {
    if (e instanceof GitCommandError && /is not a git command/.test(e.info.stderr)) return fallback()
    throw e
  }
}

/** All Git commands of the application live here. Methods take an already validated repository path. */
export class GitService {
  private network = new Map<string, AbortController>()

  async status(repo: string): Promise<GitStatus> {
    return parseStatus(await runGit(repo, STATUS_ARGS))
  }

  async getBranches(repo: string): Promise<GitBranch[]> {
    return parseBranches(await runGit(repo, BRANCH_ARGS))
  }

  async getRemotes(repo: string): Promise<GitRemote[]> {
    return parseRemotes(await runGit(repo, ['remote', '-v']))
  }

  async getLog(repo: string, options: { skip: number; limit: number }): Promise<GitCommit[]> {
    if (await this.isUnborn(repo)) return []
    return parseLog(await runGit(repo, logArgs(options.skip, options.limit)))
  }

  async getDiff(repo: string, req: DiffRequest): Promise<FileDiff> {
    const ws = req.ignoreWhitespace ? ['-w'] : []
    if (req.kind === 'commit') {
      return parseDiff(await runGit(repo, ['show', '--format=', '-m', '--first-parent', ...ws, assertHash(req.hash), '--', req.path]))
    }
    if (req.untracked) {
      // `--no-index` exits 1 when files differ; /dev/null is understood by Git on every OS
      return parseDiff(await runGit(repo, ['diff', '--no-index', ...ws, '--', '/dev/null', req.path], { okExitCodes: [0, 1] }))
    }
    return parseDiff(await runGit(repo, ['diff', ...(req.staged ? ['--cached'] : []), ...ws, '--', req.path]))
  }

  async getCommitFiles(repo: string, hash: string): Promise<ChangedFile[]> {
    return parseNameStatus(await runGit(repo, commitFilesArgs(assertHash(hash))))
  }

  async stage(repo: string, files: string[]): Promise<void> {
    await runGit(repo, ['add', '--', ...assertFiles(files)])
  }

  async stageAll(repo: string): Promise<void> {
    await runGit(repo, ['add', '-A'])
  }

  async unstage(repo: string, files: string[]): Promise<void> {
    assertFiles(files)
    if (await this.isUnborn(repo)) {
      await runGit(repo, ['rm', '--cached', '--quiet', '--', ...files])
      return
    }
    await withFallback(
      () => runGit(repo, ['restore', '--staged', '--', ...files]),
      () => runGit(repo, ['reset', '-q', 'HEAD', '--', ...files])
    )
  }

  async unstageAll(repo: string): Promise<void> {
    if (await this.isUnborn(repo)) await runGit(repo, ['rm', '--cached', '-r', '--quiet', '--', '.'])
    else await runGit(repo, ['reset', '-q', 'HEAD'])
  }

  /** Restores tracked files in the working tree. Callers must confirm with the user first. */
  async discard(repo: string, files: string[]): Promise<void> {
    assertFiles(files)
    await withFallback(
      () => runGit(repo, ['restore', '--', ...files]),
      () => runGit(repo, ['checkout', '--', ...files])
    )
  }

  /** Deletes untracked files. Callers must confirm with the user first. */
  async deleteUntracked(repo: string, files: string[]): Promise<void> {
    await runGit(repo, ['clean', '-f', '-q', '--', ...assertFiles(files)])
  }

  async commit(repo: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error('Commit message must not be empty.')
    await runGit(repo, ['commit', '-m', message], { timeout: 0 }) // hooks may be slow
  }

  async checkout(repo: string, branch: string): Promise<void> {
    assertRef(branch)
    await withFallback(
      () => runGit(repo, ['switch', branch]),
      () => runGit(repo, ['checkout', branch, '--'])
    )
  }

  /** Checks out "origin/feature/x" as a local tracking branch, or switches to it if it already exists. */
  async checkoutRemote(repo: string, remoteBranch: string): Promise<void> {
    assertRef(remoteBranch)
    const local = remoteBranch.slice(remoteBranch.indexOf('/') + 1)
    const exists = await runGit(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${local}`]).then(() => true, () => false)
    if (exists) return this.checkout(repo, local)
    await withFallback(
      () => runGit(repo, ['switch', '--track', remoteBranch]),
      () => runGit(repo, ['checkout', '--track', remoteBranch])
    )
  }

  async checkoutCommit(repo: string, hash: string): Promise<void> {
    assertHash(hash)
    await withFallback(
      () => runGit(repo, ['switch', '--detach', hash]),
      () => runGit(repo, ['checkout', '--detach', hash])
    )
  }

  async createBranch(repo: string, name: string, startPoint: string | null, checkout: boolean): Promise<void> {
    await runGit(repo, ['check-ref-format', '--branch', assertRef(name)])
    const start = startPoint ? [assertRef(startPoint)] : []
    if (!checkout) {
      await runGit(repo, ['branch', name, ...start])
      return
    }
    await withFallback(
      () => runGit(repo, ['switch', '-c', name, ...start]),
      () => runGit(repo, ['checkout', '-b', name, ...start])
    )
  }

  /** Without `force` Git refuses to delete unmerged branches; the UI then asks before forcing. */
  async deleteBranch(repo: string, name: string, force: boolean): Promise<void> {
    await runGit(repo, ['branch', force ? '-D' : '-d', assertRef(name)])
  }

  async merge(repo: string, branch: string): Promise<void> {
    await runGit(repo, ['merge', '--no-edit', assertRef(branch)], { timeout: 0 })
  }

  fetch(repo: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['fetch', '--all', '--prune', '--progress'], onOutput)
  }

  pull(repo: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['pull', '--progress'], onOutput)
  }

  async push(repo: string, setUpstream: boolean, onOutput: Output): Promise<void> {
    if (!setUpstream) return this.runNetwork(repo, ['push', '--progress'], onOutput)
    const branch = (await runGit(repo, ['symbolic-ref', '--short', 'HEAD'])).trim()
    const remotes = await this.getRemotes(repo)
    const remote = remotes.find((r) => r.name === 'origin')?.name ?? remotes[0]?.name
    if (!remote) throw new Error('This repository has no remote configured.')
    return this.runNetwork(repo, ['push', '--progress', '-u', remote, branch], onOutput)
  }

  cancel(repo: string): void {
    this.network.get(repo)?.abort()
  }

  async getStashes(repo: string): Promise<GitStash[]> {
    return parseStashes(await runGit(repo, STASH_LIST_ARGS))
  }

  async stash(repo: string, options: { message: string; includeUntracked: boolean }): Promise<void> {
    const args = ['stash', 'push']
    if (options.includeUntracked) args.push('-u')
    if (options.message.trim()) args.push('-m', options.message.trim())
    await runGit(repo, args)
  }

  async applyStash(repo: string, ref: string): Promise<void> {
    await runGit(repo, ['stash', 'apply', assertStash(ref)])
  }

  async popStash(repo: string, ref: string): Promise<void> {
    await runGit(repo, ['stash', 'pop', assertStash(ref)])
  }

  async dropStash(repo: string, ref: string): Promise<void> {
    await runGit(repo, ['stash', 'drop', assertStash(ref)])
  }

  private async isUnborn(repo: string): Promise<boolean> {
    return runGit(repo, ['rev-parse', '--verify', '--quiet', 'HEAD']).then(() => false, () => true)
  }

  private async runNetwork(repo: string, args: string[], onOutput: Output): Promise<void> {
    if (this.network.has(repo)) throw new Error('Another network operation is already running for this repository.')
    const controller = new AbortController()
    this.network.set(repo, controller)
    try {
      await runGit(repo, args, { timeout: 0, signal: controller.signal, onOutput })
    } finally {
      this.network.delete(repo)
    }
  }
}
