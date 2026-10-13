import { create } from 'zustand'
import type { GitFileStatus, RepositoryId, Result } from '../../shared/types'
import {
  getRepo,
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
    if (stagedFiles.length === 0) {
      if (unstagedFiles.length === 0) return
      const staged = await actions.stageAll(id)
      if (!staged.ok) return
    }
    const result = await run(id, `Commit "${message.split('\n')[0]}"`, () => window.git.commit(id, message), {
      flag: 'committing',
      refresh: ['worktree', 'history', 'refs']
    })
    if (result.ok) patchRepo(id, { commitMessage: '', selectedFile: null })
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

  merge(id: RepositoryId, branch: string): void {
    const current = getRepo(id)?.status?.branch ?? 'HEAD'
    confirm({
      title: 'Merge branch',
      message: `Merge "${branch}" into "${current}"?`,
      confirmLabel: 'Merge',
      onConfirm: () => void run(id, `Merge ${branch} into ${current}`, () => window.git.merge(id, branch), { refresh: ['worktree', 'refs', 'history'] })
    })
  },

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
