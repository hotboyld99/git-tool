import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ChangedFile,
  DiffRequest,
  FileBlame,
  FileDiff,
  FlowKind,
  GitFlowConfig,
  GitSubmodule,
  GitWorktree,
  LfsInfo,
  RebaseStep,
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
import { GitCommandError, getGitExecutable, runGit } from '../git/executor'
import { STATUS_ARGS, parseStatus } from '../git/status'
import { BRANCH_ARGS, TAG_ARGS, parseBranches, parseTags } from '../git/branch'
import { logArgs, parseLog, rangeArgs, showArgs } from '../git/log'
import { parseDiff } from '../git/diff'
import { commitFilesArgs, parseNameStatus } from '../git/commit'
import { parseRemotes } from '../git/remote'
import { STASH_LIST_ARGS, parseStashes } from '../git/stash'
import { blameArgs, parseBlame } from '../git/blame'
import { parseLfs, parseSubmodules, parseWorktrees } from '../git/extras'

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
  ['MERGE_HEAD', 'merge'],
  ['BISECT_LOG', 'bisect']
]

const REBASE_ACTIONS = ['pick', 'reword', 'squash', 'fixup', 'drop']

/** Quotes for the POSIX shell Git runs editors and `exec` lines with (also Git for Windows' sh). */
const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

// editors are never opened: "true" keeps the message Git prepared (also a builtin of Git for Windows' sh)
const NO_EDITOR = { GIT_EDITOR: 'true' }

const FLOW_DEFAULTS = { feature: 'feature/', release: 'release/', hotfix: 'hotfix/', versionTag: '' }

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
  /** `git branch -m` also moves the branch's upstream config and keeps HEAD on it when it is checked out */
  async renameBranch(repo: string, name: string, newName: string): Promise<void> {
    await runGit(repo, ['check-ref-format', '--branch', assertRef(newName)])
    await runGit(repo, ['branch', '-m', assertRef(name), newName])
  }

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

  async rebaseContinue(repo: string): Promise<void> {
    await runGit(repo, ['rebase', '--continue'], { timeout: 0, env: NO_EDITOR })
  }

  async rebaseCommits(repo: string, base: string): Promise<{ commits: GitCommit[]; merges: number }> {
    assertHash(base)
    await runGit(repo, ['merge-base', '--is-ancestor', base, 'HEAD']).catch(() => {
      throw new Error('The selected commit is not an ancestor of the current branch.')
    })
    const [log, merges] = await Promise.all([
      runGit(repo, rangeArgs(`${base}..HEAD`)),
      runGit(repo, ['rev-list', '--merges', '--count', `${base}..HEAD`])
    ])
    return { commits: parseLog(log), merges: Number(merges.trim()) }
  }

  /**
   * Runs `git rebase -i <base>` with our own todo list: the sequence editor just copies the prepared file.
   * Reworded messages are applied with `exec git commit --amend -F <file>` so no editor is ever needed.
   */
  async interactiveRebase(repo: string, base: string, steps: RebaseStep[]): Promise<void> {
    assertHash(base)
    if (steps.length === 0) throw new Error('Nothing to rebase.')
    const dir = await mkdtemp(join(tmpdir(), 'git-tool-rebase-'))
    const todo: string[] = []
    for (const [i, step] of steps.entries()) {
      if (!REBASE_ACTIONS.includes(step.action)) throw new Error(`Invalid rebase action: ${step.action}`)
      assertHash(step.hash)
      if (step.action !== 'reword') {
        todo.push(`${step.action} ${step.hash}`)
        continue
      }
      if (!step.message?.trim()) throw new Error('A reworded commit needs a message.')
      const messageFile = join(dir, `message-${i}.txt`)
      await writeFile(messageFile, step.message.trim() + '\n')
      todo.push(`pick ${step.hash}`, `exec ${shellQuote(getGitExecutable())} commit --amend --allow-empty --quiet -F ${shellQuote(messageFile)}`)
    }
    const todoFile = join(dir, 'todo')
    await writeFile(todoFile, todo.join('\n') + '\n')
    await runGit(repo, ['rebase', '-i', base], {
      timeout: 0,
      env: { ...NO_EDITOR, GIT_SEQUENCE_EDITOR: `cp ${shellQuote(todoFile)}` }
    })
    // ponytail: on conflicts the temp dir stays (later exec lines still need the message files); the OS cleans tmp
    await rm(dir, { recursive: true, force: true })
  }

  async bisectStart(repo: string, bad: string, good: string): Promise<string> {
    return (await runGit(repo, ['bisect', 'start', assertHash(bad), assertHash(good), '--'])).trim()
  }

  async bisectMark(repo: string, verdict: 'good' | 'bad' | 'skip'): Promise<string> {
    if (!['good', 'bad', 'skip'].includes(verdict)) throw new Error(`Invalid bisect verdict: ${verdict}`)
    return (await runGit(repo, ['bisect', verdict])).trim()
  }

  async getWorktrees(repo: string): Promise<GitWorktree[]> {
    return parseWorktrees(await runGit(repo, ['worktree', 'list', '--porcelain']))
  }

  async addWorktree(repo: string, path: string, branch: string, createBranch: boolean): Promise<void> {
    assertRef(branch)
    await runGit(repo, createBranch ? ['worktree', 'add', '-b', branch, '--', path] : ['worktree', 'add', '--', path, branch])
  }

  /** Only paths Git lists as (non-main) worktrees of this repository can be removed. */
  async removeWorktree(repo: string, path: string, force: boolean): Promise<void> {
    const worktree = (await this.getWorktrees(repo)).find((w) => w.path === path)
    if (!worktree || worktree.isMain) throw new Error('Not a linked worktree of this repository.')
    await runGit(repo, ['worktree', 'remove', ...(force ? ['--force'] : []), '--', path])
  }

  async pruneWorktrees(repo: string): Promise<void> {
    await runGit(repo, ['worktree', 'prune'])
  }

  async getSubmodules(repo: string): Promise<GitSubmodule[]> {
    if (!existsSync(join(repo, '.gitmodules'))) return []
    return parseSubmodules(await runGit(repo, ['submodule', 'status']))
  }

  updateSubmodules(repo: string, onOutput: Output, path?: string): Promise<void> {
    return this.runNetwork(repo, ['submodule', 'update', '--init', '--recursive', '--progress', ...(path ? ['--', path] : [])], onOutput)
  }

  async getLfs(repo: string): Promise<LfsInfo> {
    const version = await runGit(repo, ['lfs', 'version']).catch(() => null)
    if (!version) return { installed: false, patterns: [], files: [] }
    const [track, files] = await Promise.all([runGit(repo, ['lfs', 'track']), runGit(repo, ['lfs', 'ls-files'])])
    return { installed: true, version: version.trim(), ...parseLfs(track, files) }
  }

  lfsPull(repo: string, onOutput: Output): Promise<void> {
    return this.runNetwork(repo, ['lfs', 'pull'], onOutput)
  }

  /** Git Flow implemented with plain Git (no git-flow extension needed), using the same `gitflow.*` config keys. */
  async getGitFlow(repo: string): Promise<GitFlowConfig | null> {
    const config = await runGit(repo, ['config', '--get-regexp', '^gitflow\\.'], { okExitCodes: [0, 1] })
    const get = (key: string): string | undefined => config.split('\n').find((l) => l.startsWith(`gitflow.${key} `))?.slice(key.length + 9)
    const develop = get('branch.develop')
    const main = get('branch.master')
    if (!develop || !main) return null
    return {
      main,
      develop,
      feature: get('prefix.feature') ?? FLOW_DEFAULTS.feature,
      release: get('prefix.release') ?? FLOW_DEFAULTS.release,
      hotfix: get('prefix.hotfix') ?? FLOW_DEFAULTS.hotfix,
      versionTag: get('prefix.versiontag') ?? FLOW_DEFAULTS.versionTag
    }
  }

  async gitFlowInit(repo: string): Promise<void> {
    const local = (await this.getBranches(repo)).filter((b) => !b.isRemote).map((b) => b.name)
    const main = ['main', 'master'].find((b) => local.includes(b))
    if (!main) throw new Error('Git Flow needs a "main" or "master" branch.')
    if (!local.includes('develop')) await runGit(repo, ['branch', 'develop', main])
    const values: [string, string][] = [
      ['branch.master', main],
      ['branch.develop', 'develop'],
      ['prefix.feature', FLOW_DEFAULTS.feature],
      ['prefix.release', FLOW_DEFAULTS.release],
      ['prefix.hotfix', FLOW_DEFAULTS.hotfix],
      ['prefix.support', 'support/'],
      ['prefix.versiontag', FLOW_DEFAULTS.versionTag]
    ]
    for (const [key, value] of values) await runGit(repo, ['config', `gitflow.${key}`, value])
  }

  async gitFlowStart(repo: string, kind: FlowKind, name: string): Promise<void> {
    const flow = await this.requireFlow(repo)
    const branch = `${flow[kind]}${name.trim()}`
    await runGit(repo, ['check-ref-format', '--branch', assertRef(branch)])
    await runGit(repo, ['switch', '-c', branch, kind === 'hotfix' ? flow.main : flow.develop])
  }

  /**
   * feature: merge into develop. release/hotfix: merge into main, tag the version, merge into develop.
   * Then delete the branch. Each step is safe to re-run after resolving a conflict (merges of already merged
   * branches are no-ops and an existing tag is kept).
   */
  async gitFlowFinish(repo: string, branch: string): Promise<void> {
    const flow = await this.requireFlow(repo)
    assertRef(branch)
    const kind = (['feature', 'release', 'hotfix'] as const).find((k) => branch.startsWith(flow[k]))
    if (!kind) throw new Error(`"${branch}" is not a Git Flow feature, release or hotfix branch.`)
    const merge = async (target: string): Promise<void> => {
      await runGit(repo, ['switch', target])
      await runGit(repo, ['merge', '--no-ff', '--no-edit', branch], { timeout: 0 })
    }
    if (kind !== 'feature') {
      const version = branch.slice(flow[kind].length)
      const tag = `${flow.versionTag}${version}`
      await merge(flow.main)
      const tagged = await runGit(repo, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]).then(() => true, () => false)
      if (!tagged) await runGit(repo, ['tag', '-a', tag, '-m', `${kind === 'release' ? 'Release' : 'Hotfix'} ${version}`])
    }
    await merge(flow.develop)
    await runGit(repo, ['branch', '-d', branch])
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
    if (!operation) throw new Error('No merge, cherry-pick, revert, rebase or bisect is in progress.')
    await runGit(repo, operation === 'bisect' ? ['bisect', 'reset'] : [operation, '--abort'])
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

  private async requireFlow(repo: string): Promise<GitFlowConfig> {
    const flow = await this.getGitFlow(repo)
    if (!flow) throw new Error('Git Flow is not initialized in this repository.')
    return flow
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
