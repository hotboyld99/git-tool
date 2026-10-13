import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ChangedFile,
  DiffRequest,
  FileBlame,
  FileDiff,
  GitBranch,
  GitCommit,
  GitRemote,
  GitStash,
  GitStatus,
  GitTag,
  LogOptions,
  RepoOperation,
  ResetMode
} from '../../shared/types'
import { GitCommandError, runGit } from '../git/executor'
import { STATUS_ARGS, parseStatus } from '../git/status'
import { BRANCH_ARGS, TAG_ARGS, parseBranches, parseTags } from '../git/branch'
import { logArgs, parseLog, showArgs } from '../git/log'
import { parseDiff } from '../git/diff'
import { commitFilesArgs, parseNameStatus } from '../git/commit'
import { parseRemotes } from '../git/remote'
import { STASH_LIST_ARGS, parseStashes } from '../git/stash'
import { blameArgs, parseBlame } from '../git/blame'

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

// marker file in the git dir -> operation in progress (checked in this order)
const OPERATION_MARKERS: [string, RepoOperation][] = [
  ['rebase-merge', 'rebase'],
  ['rebase-apply', 'rebase'],
  ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ['REVERT_HEAD', 'revert'],
  ['MERGE_HEAD', 'merge']
]

function assertUrl(url: string): string {
  if (!url.trim() || url.startsWith('-') || /[\0\n]/.test(url)) throw new Error(`Invalid remote URL: "${url}"`)
  return url.trim()
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
  private gitDirs = new Map<string, string>()

  async status(repo: string): Promise<GitStatus> {
    const [output, gitDir] = await Promise.all([runGit(repo, STATUS_ARGS), this.gitDir(repo)])
    const status = parseStatus(output)
    status.operation = OPERATION_MARKERS.find(([file]) => existsSync(join(gitDir, file)))?.[1] ?? null
    const messageFile = join(gitDir, 'MERGE_MSG')
    if (status.operation && existsSync(messageFile)) {
      status.mergeMessage = readFileSync(messageFile, 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n')
        .trim()
    }
    return status
  }

  async getTags(repo: string): Promise<GitTag[]> {
    return parseTags(await runGit(repo, TAG_ARGS))
  }

  async getBranches(repo: string): Promise<GitBranch[]> {
    return parseBranches(await runGit(repo, BRANCH_ARGS))
  }

  async getRemotes(repo: string): Promise<GitRemote[]> {
    return parseRemotes(await runGit(repo, ['remote', '-v']))
  }

  async getLog(repo: string, options: LogOptions): Promise<GitCommit[]> {
    if (options.ref) assertRef(options.ref)
    if (await this.isUnborn(repo)) return []
    const commits = parseLog(await runGit(repo, logArgs(options)))
    // a search that looks like a hash also finds that commit
    const search = options.search?.trim() ?? ''
    if (options.skip === 0 && /^[0-9a-f]{4,64}$/i.test(search)) {
      const [match] = parseLog(await runGit(repo, showArgs(`${search}^{commit}`)).catch(() => ''))
      if (match && !commits.some((c) => c.hash === match.hash)) commits.unshift(match)
    }
    return commits
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
    // unmerged files: show the working copy (with conflict markers) against HEAD
    const base = req.conflicted ? ['HEAD'] : req.staged ? ['--cached'] : []
    return parseDiff(await runGit(repo, ['diff', ...base, ...ws, '--', req.path]))
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

  /** `amend` replaces HEAD (message and staged changes); it rewrites history, the UI warns when HEAD is pushed. */
  async commit(repo: string, message: string, amend = false): Promise<void> {
    if (!message.trim()) throw new Error('Commit message must not be empty.')
    await runGit(repo, ['commit', ...(amend ? ['--amend'] : []), '-m', message], { timeout: 0 }) // hooks may be slow
  }

  async headMessage(repo: string): Promise<string> {
    return (await runGit(repo, ['log', '-1', '--format=%B'])).trim()
  }

  async blame(repo: string, path: string, hash: string | null): Promise<FileBlame> {
    return parseBlame(await runGit(repo, blameArgs(path, hash === null ? null : assertHash(hash))))
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

  /** Rebases the current branch onto `onto`; conflicts stop it (status.operation = 'rebase'). */
  async rebase(repo: string, onto: string): Promise<void> {
    await runGit(repo, ['rebase', assertRef(onto)], { timeout: 0 })
  }

  /** core.editor=true keeps each commit's message instead of opening an editor. */
  async rebaseContinue(repo: string): Promise<void> {
    await runGit(repo, ['-c', 'core.editor=true', 'rebase', '--continue'], { timeout: 0 })
  }

  async rebaseSkip(repo: string): Promise<void> {
    await runGit(repo, ['rebase', '--skip'], { timeout: 0 })
  }

  async cherryPick(repo: string, hash: string): Promise<void> {
    await runGit(repo, ['cherry-pick', ...(await this.mainlineArgs(repo, hash)), hash], { timeout: 0 })
  }

  async revert(repo: string, hash: string): Promise<void> {
    await runGit(repo, ['revert', '--no-edit', ...(await this.mainlineArgs(repo, hash)), hash], { timeout: 0 })
  }

  /** `hard` discards working tree changes: callers must confirm with the user first. */
  async reset(repo: string, hash: string, mode: ResetMode): Promise<void> {
    if (!['soft', 'mixed', 'hard'].includes(mode)) throw new Error(`Invalid reset mode: ${mode}`)
    await runGit(repo, ['reset', `--${mode}`, assertHash(hash)])
  }

  async abortOperation(repo: string): Promise<void> {
    const { operation } = await this.status(repo)
    if (!operation) throw new Error('No merge, cherry-pick, revert or rebase is in progress.')
    await runGit(repo, [operation, '--abort'])
  }

  /** Takes our/their whole version of conflicted files and marks them resolved. */
  async resolveConflict(repo: string, files: string[], side: 'ours' | 'theirs'): Promise<void> {
    if (side !== 'ours' && side !== 'theirs') throw new Error(`Invalid side: ${side}`)
    assertFiles(files)
    await runGit(repo, ['checkout', `--${side}`, '--', ...files])
    await runGit(repo, ['add', '--', ...files])
  }

  async createTag(repo: string, name: string, hash: string, message: string): Promise<void> {
    await runGit(repo, ['check-ref-format', `refs/tags/${assertRef(name)}`]).catch(() => {
      throw new Error(`"${name}" is not a valid tag name.`)
    })
    const annotated = message.trim() ? ['-a', '-m', message.trim()] : []
    await runGit(repo, ['tag', ...annotated, name, assertHash(hash)])
  }

  async deleteTag(repo: string, name: string): Promise<void> {
    await runGit(repo, ['tag', '-d', assertRef(name)])
  }

  async pushTag(repo: string, name: string, onOutput: Output): Promise<void> {
    const remote = await this.defaultRemote(repo)
    return this.runNetwork(repo, ['push', '--progress', remote, `refs/tags/${assertRef(name)}`], onOutput)
  }

  fetch(repo: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['fetch', '--all', '--prune', '--progress'], onOutput)
  }

  pull(repo: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['pull', '--progress'], onOutput)
  }

  async push(repo: string, setUpstream: boolean, onOutput: Output, remote?: string): Promise<void> {
    if (!setUpstream) return this.runNetwork(repo, ['push', '--progress'], onOutput)
    const branch = (await runGit(repo, ['symbolic-ref', '--short', 'HEAD'])).trim()
    const target = remote ? assertRef(remote) : await this.defaultRemote(repo)
    return this.runNetwork(repo, ['push', '--progress', '-u', target, branch], onOutput)
  }

  fetchRemote(repo: string, remote: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['fetch', '--prune', '--progress', assertRef(remote)], onOutput)
  }

  async addRemote(repo: string, name: string, url: string): Promise<void> {
    await runGit(repo, ['remote', 'add', assertRef(name), assertUrl(url)])
  }

  async removeRemote(repo: string, name: string): Promise<void> {
    await runGit(repo, ['remote', 'remove', assertRef(name)])
  }

  async setRemoteUrl(repo: string, name: string, url: string): Promise<void> {
    await runGit(repo, ['remote', 'set-url', assertRef(name), assertUrl(url)])
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

  private async defaultRemote(repo: string): Promise<string> {
    const remotes = await this.getRemotes(repo)
    const remote = remotes.find((r) => r.name === 'origin')?.name ?? remotes[0]?.name
    if (!remote) throw new Error('This repository has no remote configured.')
    return remote
  }

  /** Merge commits need `-m 1` (relative to the first parent) for cherry-pick / revert. */
  private async mainlineArgs(repo: string, hash: string): Promise<string[]> {
    const parents = (await runGit(repo, ['rev-list', '--parents', '-n1', assertHash(hash)])).trim().split(' ')
    return parents.length > 2 ? ['-m', '1'] : []
  }

  /** Absolute git dir (differs from <repo>/.git for worktrees and submodules). */
  private async gitDir(repo: string): Promise<string> {
    let dir = this.gitDirs.get(repo)
    if (!dir) {
      dir = (await runGit(repo, ['rev-parse', '--absolute-git-dir'])).trim()
      this.gitDirs.set(repo, dir)
    }
    return dir
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
