export type Selection = { type: 'changes' } | { type: 'commit'; hash: string } | { type: 'stash'; ref: string; hash: string }

export type SelectedFile =
  | { source: 'working'; path: string; staged: boolean; untracked: boolean; conflicted?: boolean }
  | { source: 'commit'; hash: string; path: string }

export interface HistoryFilter {
  search: string
  author: string
  /** '' = all branches */
  ref: string
}

interface WorkspaceState {
  selection: Selection
  selectedFile: SelectedFile | null
  historyFilter: HistoryFilter
  commitMessage: string
}

/** Per repository working state that survives restarts (stored by repository path). */
export type SavedWorkspace = Partial<WorkspaceState>

const key = (path: string): string => `workspace:${path}`
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isString = (v: unknown): v is string => typeof v === 'string'

function selection(v: unknown): Selection | undefined {
  if (!isObject(v)) return undefined
  if (v.type === 'changes') return { type: 'changes' }
  if (v.type === 'commit' && isString(v.hash)) return { type: 'commit', hash: v.hash }
  if (v.type === 'stash' && isString(v.ref) && isString(v.hash)) return { type: 'stash', ref: v.ref, hash: v.hash }
  return undefined
}

function selectedFile(v: unknown): SelectedFile | null | undefined {
  if (v === null) return null
  if (!isObject(v) || !isString(v.path)) return undefined
  if (v.source === 'commit' && isString(v.hash)) return { source: 'commit', hash: v.hash, path: v.path }
  if (v.source === 'working') return { source: 'working', path: v.path, staged: v.staged === true, untracked: v.untracked === true, conflicted: v.conflicted === true }
  return undefined
}

function historyFilter(v: unknown): HistoryFilter | undefined {
  if (!isObject(v) || !isString(v.search) || !isString(v.author) || !isString(v.ref)) return undefined
  return { search: v.search, author: v.author, ref: v.ref }
}

/** Reads a saved workspace; anything malformed (old versions, manual edits) is ignored field by field. */
export function loadWorkspace(path: string): SavedWorkspace {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key(path)) ?? 'null')
    if (!isObject(raw)) return {}
    const saved: SavedWorkspace = {
      selection: selection(raw.selection),
      selectedFile: selectedFile(raw.selectedFile),
      historyFilter: historyFilter(raw.historyFilter),
      commitMessage: isString(raw.commitMessage) ? raw.commitMessage : undefined
    }
    return Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined))
  } catch {
    return {}
  }
}

const written = new Map<string, string>()

export function saveWorkspace(repo: WorkspaceState & { info: { path: string } }): void {
  const { selection, selectedFile, historyFilter, commitMessage } = repo
  const json = JSON.stringify({ selection, selectedFile, historyFilter, commitMessage })
  if (written.get(repo.info.path) === json) return
  written.set(repo.info.path, json)
  try {
    localStorage.setItem(key(repo.info.path), json)
  } catch {
    /* storage unavailable or full: the session just isn't remembered */
  }
}
