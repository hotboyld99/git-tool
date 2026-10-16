import { create } from 'zustand'
import type {
  GitBranch,
  GitCommit,
  GitFlowConfig,
  GitSubmodule,
  GitWorktree,
  LfsInfo,
  GitRemote,
  GitStash,
  GitStatus,
  GitTag,
  OpenResult,
  RepoChangedEvent,
  RepositoryId,
  RepositoryInfo,
  Result
} from '../../shared/types'
import { openDialog, showError } from './ui.store'
import { loadWorkspace, saveWorkspace, type HistoryFilter, type SelectedFile, type Selection } from '../utils/workspace'

export type { HistoryFilter, SelectedFile, Selection }

export type LoadingKey = 'status' | 'log' | 'fetching' | 'pulling' | 'pushing' | 'committing'

export interface RepositoryState {
  info: RepositoryInfo
  status: GitStatus | null
  branches: GitBranch[]
  remotes: GitRemote[]
  stashes: GitStash[]
  tags: GitTag[]
  worktrees: GitWorktree[]
  submodules: GitSubmodule[]
  lfs: LfsInfo | null
  /** null = Git Flow not initialized */
  flow: GitFlowConfig | null
  /** Git's last bisect message ("Bisecting: …" / "<hash> is the first bad commit") */
  bisectMessage: string
  commits: GitCommit[]
  hasMoreCommits: boolean
  historyFilter: HistoryFilter
  selection: Selection
  selectedFile: SelectedFile | null
  commitMessage: string
  amend: boolean
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
const MAX_PAGE_SIZE = 5000
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

/** undefined = failed (error shown) or superseded by a newer request */
async function load<T>(id: RepositoryId, kind: string, call: Promise<Result<T>>): Promise<T | undefined> {
  const key = `${id}:${kind}`
  const n = (sequence.get(key) ?? 0) + 1
  sequence.set(key, n)
  const result = await call
  if (sequence.get(key) !== n || !getRepo(id)) return undefined
  if (!result.ok) {
    showError(result.error)
    return undefined
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
  // a merge / cherry-pick / revert just stopped on conflicts: offer Git's prepared message
  if (status.operation && !previous?.operation && status.mergeMessage && !getRepo(id)?.commitMessage) {
    patchRepo(id, { commitMessage: status.mergeMessage })
  }
  if (followHead && previous && previous.head !== status.head) await refreshHistory(id)
}

export async function refreshRefs(id: RepositoryId): Promise<void> {
  const [branches, remotes, tags, worktrees, submodules, lfs, flow] = await Promise.all([
    load(id, 'branches', window.git.branches(id)),
    load(id, 'remotes', window.git.remotes(id)),
    load(id, 'tags', window.git.tags(id)),
    load(id, 'worktrees', window.git.worktrees(id)),
    load(id, 'submodules', window.git.submodules(id)),
    load(id, 'lfs', window.git.lfs(id)),
    load(id, 'flow', window.git.gitFlow(id))
  ])
  if (branches) patchRepo(id, { branches })
  // the branch the history was filtered on was deleted: show all branches again
  const ref = getRepo(id)?.historyFilter.ref
  if (branches && ref && !branches.some((b) => b.name === ref)) setHistoryFilter(id, { ref: '' })
  if (remotes) patchRepo(id, { remotes })
  if (tags) patchRepo(id, { tags })
  if (worktrees) patchRepo(id, { worktrees })
  if (submodules) patchRepo(id, { submodules })
  if (lfs) patchRepo(id, { lfs })
  if (flow !== undefined) patchRepo(id, { flow }) // null is a valid answer: not initialized
}

export async function refreshStashes(id: RepositoryId): Promise<void> {
  const stashes = await load(id, 'stashes', window.git.stashes(id))
  if (stashes) patchRepo(id, { stashes })
}

const filterOptions = ({ search, author, ref }: HistoryFilter) => ({ search: search.trim(), author: author.trim(), ref })

/** Reloads every page loaded so far (so scroll position and selection survive), or only the first page after `reset`. */
export async function refreshHistory(id: RepositoryId, reset = false): Promise<void> {
  const repo = getRepo(id)
  if (!repo) return
  const limit = reset ? PAGE_SIZE : Math.min(50_000, Math.max(PAGE_SIZE, repo.commits.length))
  setLoading(id, 'log', true)
  const commits = await load(id, 'log', window.git.log(id, { skip: 0, limit, ...filterOptions(repo.historyFilter) }))
  setLoading(id, 'log', false)
  if (commits) patchRepo(id, { commits, hasMoreCommits: commits.length === limit })
}

export async function loadMoreHistory(id: RepositoryId): Promise<void> {
  const repo = getRepo(id)
  if (!repo || repo.loading.log || !repo.hasMoreCommits) return
  // Pages double in size: without a commit-graph file `git log --date-order` walks the whole history on every
  // call, so the number of calls (not their size) is what makes deep scrolling slow on large repositories.
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(PAGE_SIZE, repo.commits.length))
  setLoading(id, 'log', true)
  const more = await load(id, 'log', window.git.log(id, { skip: repo.commits.length, limit, ...filterOptions(repo.historyFilter) }))
  setLoading(id, 'log', false)
  if (!more) return
  patchRepo(id, (r) => {
    const known = new Set(r.commits.map((c) => c.hash))
    return { commits: [...r.commits, ...more.filter((c) => !known.has(c.hash))], hasMoreCommits: more.length === limit }
  })
}

export function setHistoryFilter(id: RepositoryId, filter: Partial<HistoryFilter>): void {
  patchRepo(id, (r) => ({ historyFilter: { ...r.historyFilter, ...filter } }))
  void refreshHistory(id, true)
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
    tags: [],
    worktrees: [],
    submodules: [],
    lfs: null,
    flow: null,
    bisectMessage: '',
    commits: [],
    hasMoreCommits: false,
    historyFilter: { search: '', author: '', ref: '' },
    selection: { type: 'changes' },
    selectedFile: null,
    commitMessage: '',
    amend: false,
    loading: { status: false, log: false, fetching: false, pulling: false, pushing: false, committing: false },
    progress: ''
  }
}

/** New tabs start from the repository's saved workspace (selection, open diff, filters, commit draft). */
function addTab(info: RepositoryInfo): void {
  useRepos.setState((s) =>
    s.repos[info.id] ? s : { order: [...s.order, info.id], repos: { ...s.repos, [info.id]: { ...emptyRepo(info), ...loadWorkspace(info.path) } } }
  )
}

// remember each repository's workspace shortly after it changes, and right away when the window closes
const saveAll = (): void => Object.values(useRepos.getState().repos).forEach(saveWorkspace)
let saveTimer: ReturnType<typeof setTimeout> | undefined
useRepos.subscribe(() => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveAll, 400)
})
window.addEventListener('beforeunload', saveAll)

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

function handleOpen(result: OpenResult): void {
  if ('repo' in result) opened(result.repo)
  else openDialog({ type: 'notRepository', ...result.notRepository })
}

export async function openRepositoryDialog(): Promise<void> {
  const result = await window.repo.openDialog()
  if (!result.ok) showError(result.error)
  else if (result.data) handleOpen(result.data)
}

export async function openRepositoryPath(path: string): Promise<void> {
  const result = await window.repo.open(path)
  if (result.ok) return handleOpen(result.data)
  showError(result.error)
  useRepos.setState((s) => ({ recent: s.recent.filter((p) => p !== path) }))
}

export async function initRepository(path: string): Promise<boolean> {
  const result = await window.repo.init(path)
  if (!result.ok) {
    showError(result.error)
    return false
  }
  opened(result.data)
  return true
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
