import { create } from 'zustand'
import type {
  GitBranch,
  GitCommit,
  GitRemote,
  GitStash,
  GitStatus,
  RepoChangedEvent,
  RepositoryId,
  RepositoryInfo,
  Result
} from '../../shared/types'
import { showError } from './ui.store'

export type Selection = { type: 'changes' } | { type: 'commit'; hash: string } | { type: 'stash'; ref: string; hash: string }

export type SelectedFile =
  | { source: 'working'; path: string; staged: boolean; untracked: boolean }
  | { source: 'commit'; hash: string; path: string }

export type LoadingKey = 'status' | 'log' | 'fetching' | 'pulling' | 'pushing' | 'committing'

export interface RepositoryState {
  info: RepositoryInfo
  status: GitStatus | null
  branches: GitBranch[]
  remotes: GitRemote[]
  stashes: GitStash[]
  commits: GitCommit[]
  hasMoreCommits: boolean
  selection: Selection
  selectedFile: SelectedFile | null
  commitMessage: string
  loading: Record<LoadingKey, boolean>
  /** last progress line of the running network operation */
  progress: string
}

interface RepositoriesStore {
  order: RepositoryId[]
  repos: Record<RepositoryId, RepositoryState>
  activeId: RepositoryId | null
  recent: string[]
}

export const PAGE_SIZE = 100
const MAX_RECENT = 10

export const useRepos = create<RepositoriesStore>(() => ({ order: [], repos: {}, activeId: null, recent: [] }))

export const getRepo = (id: RepositoryId): RepositoryState | undefined => useRepos.getState().repos[id]

export function useRepo(id: RepositoryId): RepositoryState {
  return useRepos((s) => s.repos[id])
}

export function patchRepo(id: RepositoryId, update: Partial<RepositoryState> | ((r: RepositoryState) => Partial<RepositoryState>)): void {
  useRepos.setState((s) => {
    const repo = s.repos[id]
    if (!repo) return s
    return { repos: { ...s.repos, [id]: { ...repo, ...(typeof update === 'function' ? update(repo) : update) } } }
  })
}

export function setLoading(id: RepositoryId, key: LoadingKey, value: boolean): void {
  patchRepo(id, (r) => ({ loading: { ...r.loading, [key]: value } }))
}

export const isDirty = (s: GitStatus | null): boolean =>
  !!s && s.stagedFiles.length + s.unstagedFiles.length + s.conflictedFiles.length > 0

// Only the latest request of each kind may write, so slow responses never overwrite newer data.
const sequence = new Map<string, number>()

async function load<T>(id: RepositoryId, kind: string, call: Promise<Result<T>>): Promise<T | null> {
  const key = `${id}:${kind}`
  const n = (sequence.get(key) ?? 0) + 1
  sequence.set(key, n)
  const result = await call
  if (sequence.get(key) !== n || !getRepo(id)) return null
  if (!result.ok) {
    showError(result.error)
    return null
  }
  return result.data
}

/** git status; reloads history when HEAD moved (unless the caller reloads it anyway). */
export async function refreshWorkingTree(id: RepositoryId, followHead = true): Promise<void> {
  setLoading(id, 'status', true)
  const status = await load(id, 'status', window.git.status(id))
  setLoading(id, 'status', false)
  if (!status) return
  const previous = getRepo(id)?.status
  patchRepo(id, { status })
  if (followHead && previous && previous.head !== status.head) await refreshHistory(id)
}

export async function refreshRefs(id: RepositoryId): Promise<void> {
  const [branches, remotes] = await Promise.all([
    load(id, 'branches', window.git.branches(id)),
    load(id, 'remotes', window.git.remotes(id))
  ])
  if (branches) patchRepo(id, { branches })
  if (remotes) patchRepo(id, { remotes })
}

export async function refreshStashes(id: RepositoryId): Promise<void> {
  const stashes = await load(id, 'stashes', window.git.stashes(id))
  if (stashes) patchRepo(id, { stashes })
}

/** Reloads every page loaded so far, so the scroll position and selection survive. */
export async function refreshHistory(id: RepositoryId): Promise<void> {
  const limit = Math.max(PAGE_SIZE, getRepo(id)?.commits.length ?? 0)
  setLoading(id, 'log', true)
  const commits = await load(id, 'log', window.git.log(id, { skip: 0, limit }))
  setLoading(id, 'log', false)
  if (commits) patchRepo(id, { commits, hasMoreCommits: commits.length === limit })
}

export async function loadMoreHistory(id: RepositoryId): Promise<void> {
  const repo = getRepo(id)
  if (!repo || repo.loading.log || !repo.hasMoreCommits) return
  setLoading(id, 'log', true)
  const more = await load(id, 'log', window.git.log(id, { skip: repo.commits.length, limit: PAGE_SIZE }))
  setLoading(id, 'log', false)
  if (!more) return
  patchRepo(id, (r) => {
    const known = new Set(r.commits.map((c) => c.hash))
    return { commits: [...r.commits, ...more.filter((c) => !known.has(c.hash))], hasMoreCommits: more.length === PAGE_SIZE }
  })
}

export async function refreshAll(id: RepositoryId): Promise<void> {
  await Promise.all([refreshWorkingTree(id, false), refreshRefs(id), refreshHistory(id), refreshStashes(id)])
}

/** File system watcher notifications from the main process. */
export function onRepoChanged({ repoId, scopes }: RepoChangedEvent): void {
  if (!getRepo(repoId)) return
  if (scopes.includes('refs')) void refreshAll(repoId)
  else void refreshWorkingTree(repoId)
}

export function select(id: RepositoryId, selection: Selection): void {
  patchRepo(id, { selection, selectedFile: null })
}

export function selectFile(id: RepositoryId, selectedFile: SelectedFile | null): void {
  patchRepo(id, { selectedFile })
}

// ---- tabs -----------------------------------------------------------------

function emptyRepo(info: RepositoryInfo): RepositoryState {
  return {
    info,
    status: null,
    branches: [],
    remotes: [],
    stashes: [],
    commits: [],
    hasMoreCommits: false,
    selection: { type: 'changes' },
    selectedFile: null,
    commitMessage: '',
    loading: { status: false, log: false, fetching: false, pulling: false, pushing: false, committing: false },
    progress: ''
  }
}

function addTab(info: RepositoryInfo): void {
  useRepos.setState((s) => (s.repos[info.id] ? s : { order: [...s.order, info.id], repos: { ...s.repos, [info.id]: emptyRepo(info) } }))
}

export function activate(id: RepositoryId | null): void {
  useRepos.setState({ activeId: id })
  void window.repo.setActive(id)
}

function opened(info: RepositoryInfo): void {
  const isNew = !getRepo(info.id)
  addTab(info)
  activate(info.id)
  useRepos.setState((s) => ({ recent: [info.path, ...s.recent.filter((p) => p !== info.path)].slice(0, MAX_RECENT) }))
  if (isNew) void refreshAll(info.id)
}

export async function initSession(): Promise<void> {
  const result = await window.repo.session()
  if (!result.ok) return showError(result.error)
  const { opened: repos, activeId, recent } = result.data
  repos.forEach(addTab)
  useRepos.setState({ activeId, recent })
  await Promise.all(repos.map((r) => refreshAll(r.id)))
}

export async function openRepositoryDialog(): Promise<void> {
  const result = await window.repo.openDialog()
  if (!result.ok) showError(result.error)
  else if (result.data) opened(result.data)
}

export async function openRepositoryPath(path: string): Promise<void> {
  const result = await window.repo.open(path)
  if (!result.ok) {
    showError(result.error)
    useRepos.setState((s) => ({ recent: s.recent.filter((p) => p !== path) }))
  } else opened(result.data)
}

export async function closeRepository(id: RepositoryId): Promise<void> {
  await window.repo.close(id)
  const { order, activeId } = useRepos.getState()
  const index = order.indexOf(id)
  const nextOrder = order.filter((x) => x !== id)
  useRepos.setState((s) => {
    const repos = { ...s.repos }
    delete repos[id]
    return { order: nextOrder, repos }
  })
  if (activeId === id) activate(nextOrder[Math.min(index, nextOrder.length - 1)] ?? null)
}
