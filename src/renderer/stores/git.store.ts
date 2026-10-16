import { create } from 'zustand'
import type { FlowKind, GitFileStatus, GitWorktree, RebaseStep, RepositoryId, ResetMode, Result } from '../../shared/types'
import {
  getRepo,
  openRepositoryPath,
  patchRepo,
  refreshHistory,
  refreshRefs,
  refreshStashes,
  refreshWorkingTree,
  select,
  setLoading,
  type LoadingKey
} from './repository.store'
import { confirm, showError } from './ui.store'

// ---- operation log ----------------------------------------------------------

export interface LogEntry {
  id: number
  repoId: RepositoryId
  repoName: string
  label: string
  status: 'running' | 'success' | 'failed'
  startedAt: number
  durationMs?: number
  output: string
}

const MAX_LOG = 200
let nextLogId = 1

export const useOperationLog = create<{ entries: LogEntry[] }>(() => ({ entries: [] }))

function updateEntry(id: number, update: (e: LogEntry) => Partial<LogEntry>): void {
  useOperationLog.setState((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...update(e) } : e)) }))
}

/** Streams network progress into the repository status line and the running log entry. */
export function subscribeProgress(): () => void {
  return window.git.onProgress(({ repoId, text }) => {
    const line = text.split(/[\r\n]+/).filter(Boolean).pop()
    if (line) patchRepo(repoId, { progress: line })
    const running = useOperationLog.getState().entries.find((e) => e.repoId === repoId && e.status === 'running')
    if (running) updateEntry(running.id, (e) => ({ output: (e.output + text).slice(-20000) }))
  })
}

// ---- running operations -------------------------------------------------------

type Refresh = 'worktree' | 'refs' | 'history' | 'stashes'

const REFRESH: Record<Refresh, (id: RepositoryId) => Promise<void>> = {
  worktree: (id) => refreshWorkingTree(id, false),
  refs: refreshRefs,
  history: refreshHistory,
  stashes: refreshStashes
}

interface RunOptions {
  /** what to reload afterwards (also after failures: pulls/merges can leave conflicts) */
  refresh: Refresh[]
  flag?: LoadingKey
  /** false when the caller handles specific failures itself */
  showError?: boolean
}

async function run<T>(id: RepositoryId, label: string, call: () => Promise<Result<T>>, options: RunOptions): Promise<Result<T>> {
  const entry: LogEntry = {
    id: nextLogId++,
    repoId: id,
    repoName: getRepo(id)?.info.name ?? '',
    label,
    status: 'running',
    startedAt: Date.now(),
    output: ''
  }
  useOperationLog.setState((s) => ({ entries: [entry, ...s.entries].slice(0, MAX_LOG) }))
  if (options.flag) setLoading(id, options.flag, true)

  const result = await call()

  if (options.flag) setLoading(id, options.flag, false)
  patchRepo(id, { progress: '' })
  updateEntry(entry.id, (e) => ({
    status: result.ok ? 'success' : 'failed',
    durationMs: Date.now() - e.startedAt,
    output: result.ok ? e.output : [e.output, result.error.stderr, result.error.stdout].filter(Boolean).join('\n')
  }))
  await Promise.all(options.refresh.map((r) => REFRESH[r](id)))
  if (!result.ok && options.showError !== false) showError(result.error)
  return result
}

const describe = (files: string[]): string => (files.length === 1 ? files[0] : `${files.length} files`)

// ---- actions --------------------------------------------------------------------

export const actions = {
  stage: (id: RepositoryId, files: string[]) => run(id, `Stage ${describe(files)}`, () => window.git.stage(id, files), { refresh: ['worktree'] }),

  stageAll: (id: RepositoryId) => run(id, 'Stage all', () => window.git.stageAll(id), { refresh: ['worktree'] }),

  unstage: (id: RepositoryId, files: string[]) =>
    run(id, `Unstage ${describe(files)}`, () => window.git.unstage(id, files), { refresh: ['worktree'] }),

  unstageAll: (id: RepositoryId) => run(id, 'Unstage all', () => window.git.unstageAll(id), { refresh: ['worktree'] }),

  discard(id: RepositoryId, file: GitFileStatus): void {
    if (file.status === 'untracked') {
      confirm({
        title: 'Delete untracked file?',
        message: `"${file.path}" is not tracked by Git. It will be permanently deleted from disk and cannot be recovered.`,
        confirmLabel: 'Delete File',
        danger: true,
        onConfirm: () => void run(id, `Delete ${file.path}`, () => window.git.deleteUntracked(id, [file.path]), { refresh: ['worktree'] })
      })
      return
    }
    confirm({
      title: 'Discard changes?',
      message: `All unstaged changes in "${file.path}" will be lost. This cannot be undone.`,
      confirmLabel: 'Discard Changes',
      danger: true,
      onConfirm: () => void run(id, `Discard ${file.path}`, () => window.git.discard(id, [file.path]), { refresh: ['worktree'] })
    })
  },

  async commit(id: RepositoryId): Promise<void> {
    const repo = getRepo(id)
    const message = repo?.commitMessage.trim()
    if (!repo?.status || !message || repo.loading.committing) return
    const { stagedFiles, unstagedFiles } = repo.status
    // amending may only change the message; a normal commit with nothing staged stages everything first
    if (stagedFiles.length === 0 && !repo.amend) {
      if (unstagedFiles.length === 0) return
      const staged = await actions.stageAll(id)
      if (!staged.ok) return
    }
    const label = `${repo.amend ? 'Amend' : 'Commit'} "${message.split('\n')[0]}"`
    const result = await run(id, label, () => window.git.commit(id, message, repo.amend), {
      flag: 'committing',
      refresh: ['worktree', 'history', 'refs']
    })
    if (result.ok) patchRepo(id, { commitMessage: '', selectedFile: null, amend: false })
  },

  /** Turning amend on loads HEAD's message for editing (unless a message was already typed). */
  async setAmend(id: RepositoryId, amend: boolean): Promise<void> {
    patchRepo(id, { amend })
    if (!amend || getRepo(id)?.commitMessage.trim()) return
    const result = await window.git.headMessage(id)
    if (result.ok && getRepo(id)?.amend && !getRepo(id)?.commitMessage.trim()) patchRepo(id, { commitMessage: result.data })
  },

  checkout: (id: RepositoryId, branch: string) =>
    run(id, `Checkout ${branch}`, () => window.git.checkout(id, branch), { refresh: ['worktree', 'refs', 'history'] }),

  checkoutRemote: (id: RepositoryId, branch: string) =>
    run(id, `Checkout ${branch}`, () => window.git.checkoutRemote(id, branch), { refresh: ['worktree', 'refs', 'history'] }),

  checkoutCommit(id: RepositoryId, hash: string): void {
    confirm({
      title: 'Checkout commit?',
      message: `HEAD will be detached at ${hash.slice(0, 7)}. New commits will not belong to any branch until you create one.`,
      confirmLabel: 'Checkout',
      onConfirm: () =>
        void run(id, `Checkout ${hash.slice(0, 7)}`, () => window.git.checkoutCommit(id, hash), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

  createBranch: (id: RepositoryId, name: string, startPoint: string | null, checkout: boolean) =>
    run(id, `Create branch ${name}`, () => window.git.createBranch(id, name, startPoint, checkout), {
      refresh: ['worktree', 'refs', 'history']
    }),

  deleteBranch(id: RepositoryId, name: string): void {
    const remove = (force: boolean) =>
      run(id, `Delete branch ${name}`, () => window.git.deleteBranch(id, name, force), { refresh: ['refs', 'history'], showError: false })
    confirm({
      title: 'Delete branch?',
      message: `Delete local branch "${name}"?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const result = await remove(false)
        if (result.ok) return
        if (!/not fully merged/.test(result.error.stderr)) return showError(result.error)
        confirm({
          title: 'Branch is not fully merged',
          message: `"${name}" contains commits that are not merged. Force deleting it may lose those commits.`,
          confirmLabel: 'Force Delete',
          danger: true,
          onConfirm: async () => {
            const forced = await remove(true)
            if (!forced.ok) showError(forced.error)
          }
        })
      }
    })
  },

  /** merges `branch` into `into` (default: the current branch), checking `into` out first when needed */
  merge(id: RepositoryId, branch: string, into?: string): void {
    const current = getRepo(id)?.status?.branch ?? 'HEAD'
    const target = into ?? current
    const switching = target !== current
    confirm({
      title: 'Merge branch',
      message: switching ? `Checkout "${target}" and merge "${branch}" into it?` : `Merge "${branch}" into "${target}"?`,
      confirmLabel: 'Merge',
      onConfirm: async () => {
        if (switching && !(await actions.checkout(id, target)).ok) return
        void run(id, `Merge ${branch} into ${target}`, () => window.git.merge(id, branch), { refresh: ['worktree', 'refs', 'history'] })
      }
    })
  },

  rebase(id: RepositoryId, onto: string): void {
    const current = getRepo(id)?.status?.branch ?? 'HEAD'
    confirm({
      title: 'Rebase branch',
      message: `Replay the commits of "${current}" on top of "${onto}"? This rewrites the history of "${current}"; avoid it for branches others already use.`,
      confirmLabel: 'Rebase',
      onConfirm: () => void run(id, `Rebase ${current} onto ${onto}`, () => window.git.rebase(id, onto), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

  rebaseContinue: (id: RepositoryId) =>
    run(id, 'Continue rebase', () => window.git.rebaseContinue(id), { refresh: ['worktree', 'refs', 'history'] }),

  rebaseSkip(id: RepositoryId): void {
    confirm({
      title: 'Skip this commit?',
      message: 'The commit being replayed is dropped from the rebased branch, together with your conflict resolutions for it.',
      confirmLabel: 'Skip Commit',
      danger: true,
      onConfirm: () => void run(id, 'Skip rebase commit', () => window.git.rebaseSkip(id), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

  interactiveRebase: (id: RepositoryId, base: string, steps: RebaseStep[]) =>
    run(id, `Interactive rebase onto ${base.slice(0, 7)}`, () => window.git.interactiveRebase(id, base, steps), {
      refresh: ['worktree', 'refs', 'history']
    }),

  async bisectStart(id: RepositoryId, good: string): Promise<void> {
    const bad = getRepo(id)?.status?.head
    if (!bad) return
    const result = await run(id, `Bisect ${good.slice(0, 7)}..${bad.slice(0, 7)}`, () => window.git.bisectStart(id, bad, good), {
      refresh: ['worktree', 'refs', 'history']
    })
    if (result.ok) patchRepo(id, { bisectMessage: result.data })
  },

  async bisectMark(id: RepositoryId, verdict: 'good' | 'bad' | 'skip'): Promise<void> {
    const result = await run(id, `Bisect: mark ${verdict}`, () => window.git.bisectMark(id, verdict), { refresh: ['worktree', 'refs', 'history'] })
    if (result.ok) patchRepo(id, { bisectMessage: result.data })
  },

  async addWorktree(id: RepositoryId, branch: string, createBranch: boolean): Promise<Result<string | null>> {
    const result = await run(id, `Add worktree for ${branch}`, () => window.git.addWorktree(id, branch, createBranch), { refresh: ['refs'] })
    if (result.ok && result.data) await openRepositoryPath(result.data)
    return result
  },

  removeWorktree(id: RepositoryId, worktree: GitWorktree): void {
    const remove = (force: boolean) =>
      run(id, `Remove worktree ${worktree.path}`, () => window.git.removeWorktree(id, worktree.path, force), { refresh: ['refs'], showError: false })
    confirm({
      title: 'Remove worktree?',
      message: `Delete the worktree folder "${worktree.path}"? The branch${worktree.branch ? ` "${worktree.branch}"` : ''} is kept.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        const result = await remove(false)
        if (result.ok) return
        if (!/modified or untracked files|use --force/.test(result.error.stderr)) return showError(result.error)
        confirm({
          title: 'Worktree has changes',
          message: `"${worktree.path}" contains modified or untracked files. Removing it anyway deletes those changes.`,
          confirmLabel: 'Force Remove',
          danger: true,
          onConfirm: async () => {
            const forced = await remove(true)
            if (!forced.ok) showError(forced.error)
          }
        })
      }
    })
  },

  pruneWorktrees: (id: RepositoryId) => run(id, 'Prune worktrees', () => window.git.pruneWorktrees(id), { refresh: ['refs'] }),

  updateSubmodules: (id: RepositoryId, path?: string) =>
    run(id, path ? `Update submodule ${path}` : 'Update submodules', () => window.git.updateSubmodules(id, path), {
      flag: 'fetching',
      refresh: ['worktree', 'refs']
    }),

  lfsPull: (id: RepositoryId) => run(id, 'Git LFS pull', () => window.git.lfsPull(id), { flag: 'pulling', refresh: ['worktree', 'refs'] }),

  gitFlowInit: (id: RepositoryId) => run(id, 'Initialize Git Flow', () => window.git.gitFlowInit(id), { refresh: ['refs', 'history'] }),

  gitFlowStart: (id: RepositoryId, kind: FlowKind, name: string) =>
    run(id, `Start ${kind} ${name}`, () => window.git.gitFlowStart(id, kind, name), { refresh: ['worktree', 'refs', 'history'] }),

  gitFlowFinish(id: RepositoryId, branch: string): void {
    const flow = getRepo(id)?.flow
    if (!flow) return
    const feature = branch.startsWith(flow.feature)
    const version = branch.slice(branch.indexOf('/') + 1)
    confirm({
      title: `Finish ${branch}`,
      message: feature
        ? `Merge "${branch}" into "${flow.develop}" and delete it.`
        : `Merge "${branch}" into "${flow.main}", tag it "${flow.versionTag}${version}", merge it into "${flow.develop}" and delete it.`,
      confirmLabel: 'Finish',
      onConfirm: () => void run(id, `Finish ${branch}`, () => window.git.gitFlowFinish(id, branch), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

  cherryPick: (id: RepositoryId, hash: string) =>
    run(id, `Cherry-pick ${hash.slice(0, 7)}`, () => window.git.cherryPick(id, hash), { refresh: ['worktree', 'refs', 'history'] }),

  revert(id: RepositoryId, hash: string): void {
    confirm({
      title: 'Revert commit?',
      message: `A new commit that undoes ${hash.slice(0, 7)} will be created on the current branch.`,
      confirmLabel: 'Revert',
      onConfirm: () => void run(id, `Revert ${hash.slice(0, 7)}`, () => window.git.revert(id, hash), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

  reset: (id: RepositoryId, hash: string, mode: ResetMode) =>
    run(id, `Reset (${mode}) to ${hash.slice(0, 7)}`, () => window.git.reset(id, hash, mode), { refresh: ['worktree', 'refs', 'history'] }),

  abortOperation(id: RepositoryId): void {
    const operation = getRepo(id)?.status?.operation ?? 'operation'
    const abort = async (): Promise<void> => {
      const result = await run(id, `Abort ${operation}`, () => window.git.abortOperation(id), { refresh: ['worktree', 'refs', 'history'] })
      if (result.ok) patchRepo(id, operation === 'bisect' ? { bisectMessage: '' } : { commitMessage: '' })
    }
    // ending a bisect only checks the original branch out again: nothing to lose
    if (operation === 'bisect') return void abort()
    confirm({
      title: `Abort ${operation}?`,
      message: `The ${operation} will be stopped and the repository returns to the state before it started. Conflict resolutions made so far are lost.`,
      confirmLabel: `Abort ${operation}`,
      danger: true,
      onConfirm: () => void abort()
    })
  },

  resolveConflict: (id: RepositoryId, path: string, side: 'ours' | 'theirs') =>
    run(id, `Use ${side} for ${path}`, () => window.git.resolveConflict(id, [path], side), { refresh: ['worktree'] }),

  createTag: (id: RepositoryId, name: string, hash: string, message: string) =>
    run(id, `Create tag ${name}`, () => window.git.createTag(id, name, hash, message), { refresh: ['refs', 'history'] }),

  deleteTag(id: RepositoryId, name: string): void {
    confirm({
      title: 'Delete tag?',
      message: `Delete local tag "${name}"? Tags already pushed stay on the remote.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => void run(id, `Delete tag ${name}`, () => window.git.deleteTag(id, name), { refresh: ['refs', 'history'] })
    })
  },

  pushTag: (id: RepositoryId, name: string) =>
    run(id, `Push tag ${name}`, () => window.git.pushTag(id, name), { flag: 'pushing', refresh: ['refs'] }),

  fetch: (id: RepositoryId) => run(id, 'Fetch', () => window.git.fetch(id), { flag: 'fetching', refresh: ['refs', 'history', 'worktree'] }),

  pull: (id: RepositoryId) => run(id, 'Pull', () => window.git.pull(id), { flag: 'pulling', refresh: ['worktree', 'refs', 'history'] }),

  async push(id: RepositoryId): Promise<void> {
    const push = (setUpstream: boolean) =>
      run(id, setUpstream ? 'Push & set upstream' : 'Push', () => window.git.push(id, setUpstream), {
        flag: 'pushing',
        refresh: ['refs', 'history', 'worktree'],
        showError: false
      })
    const result = await push(false)
    if (result.ok) return
    if (!/has no upstream branch/.test(result.error.stderr)) return showError(result.error)
    const branch = getRepo(id)?.status?.branch ?? ''
    confirm({
      title: 'No upstream configured.',
      message: `Branch "${branch}" has no upstream branch. Push it to the remote and set it as upstream?`,
      confirmLabel: 'Push & Set Upstream',
      onConfirm: async () => {
        const second = await push(true)
        if (!second.ok) showError(second.error)
      }
    })
  },

  cancel: (id: RepositoryId) => void window.git.cancel(id),

  pushTo: (id: RepositoryId, remote: string) =>
    run(id, `Push to ${remote}`, () => window.git.push(id, true, remote), { flag: 'pushing', refresh: ['refs', 'history', 'worktree'] }),

  fetchRemote: (id: RepositoryId, remote: string) =>
    run(id, `Fetch ${remote}`, () => window.git.fetchRemote(id, remote), { flag: 'fetching', refresh: ['refs', 'history', 'worktree'] }),

  addRemote: (id: RepositoryId, name: string, url: string) =>
    run(id, `Add remote ${name}`, () => window.git.addRemote(id, name, url), { refresh: ['refs'] }),

  setRemoteUrl: (id: RepositoryId, name: string, url: string) =>
    run(id, `Set URL of ${name}`, () => window.git.setRemoteUrl(id, name, url), { refresh: ['refs'] }),

  removeRemote(id: RepositoryId, name: string): void {
    confirm({
      title: 'Remove remote?',
      message: `Remove remote "${name}" and its remote-tracking branches from this repository? Nothing is deleted on the server.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: () => void run(id, `Remove remote ${name}`, () => window.git.removeRemote(id, name), { refresh: ['refs', 'history'] })
    })
  },

  stash: (id: RepositoryId, message: string, includeUntracked: boolean) =>
    run(id, 'Stash changes', () => window.git.stash(id, { message, includeUntracked }), { refresh: ['worktree', 'stashes'] }),

  stashApply: (id: RepositoryId, ref: string) => run(id, `Apply ${ref}`, () => window.git.stashApply(id, ref), { refresh: ['worktree', 'stashes'] }),

  stashPop: async (id: RepositoryId, ref: string) => {
    const result = await run(id, `Pop ${ref}`, () => window.git.stashPop(id, ref), { refresh: ['worktree', 'stashes'] })
    if (result.ok && getRepo(id)?.selection.type === 'stash') select(id, { type: 'changes' })
  },

  stashDrop(id: RepositoryId, ref: string): void {
    confirm({
      title: 'Drop stash?',
      message: `${ref} will be permanently deleted.`,
      confirmLabel: 'Drop',
      danger: true,
      onConfirm: async () => {
        const result = await run(id, `Drop ${ref}`, () => window.git.stashDrop(id, ref), { refresh: ['stashes'] })
        if (result.ok && getRepo(id)?.selection.type === 'stash') select(id, { type: 'changes' })
      }
    })
  }
}
