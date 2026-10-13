export type RepositoryId = string

export interface RepositoryInfo {
  id: RepositoryId
  path: string
  name: string
}

export type FileStatusKind = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

export interface GitFileStatus {
  path: string
  originalPath?: string
  status: FileStatusKind
  staged: boolean
}

export interface GitStatus {
  /** null when HEAD is detached */
  branch: string | null
  /** full HEAD hash, '' for a repository without commits */
  head: string
  upstream?: string
  ahead: number
  behind: number
  stagedFiles: GitFileStatus[]
  unstagedFiles: GitFileStatus[]
  conflictedFiles: GitFileStatus[]
}

export interface GitBranch {
  /** short name, e.g. "dev" or "origin/dev" */
  name: string
  hash: string
  isRemote: boolean
  /** remote name for remote branches */
  remote?: string
  isCurrent: boolean
  upstream?: string
  /** e.g. "ahead 1, behind 2" */
  track?: string
}

export interface GitRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface GitStash {
  index: number
  /** stash@{n} */
  ref: string
  hash: string
  branch: string
  message: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  parents: string[]
  authorName: string
  authorEmail: string
  date: string
  subject: string
  body?: string
  refs: string[]
}

export interface ChangedFile {
  path: string
  originalPath?: string
  status: FileStatusKind
}

export type DiffRequest =
  | { kind: 'working'; path: string; staged: boolean; untracked?: boolean; ignoreWhitespace?: boolean }
  | { kind: 'commit'; hash: string; path: string; ignoreWhitespace?: boolean }

export type DiffLineType = 'context' | 'add' | 'del' | 'meta'

export interface DiffLine {
  type: DiffLineType
  oldNo?: number
  newNo?: number
  content: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface FileDiff {
  raw: string
  binary: boolean
  hunks: DiffHunk[]
}

export interface GitError {
  operation: string
  exitCode: number
  stdout: string
  stderr: string
  command?: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: GitError }

export interface Session {
  opened: RepositoryInfo[]
  activeId: RepositoryId | null
  recent: string[]
}

export interface ProgressEvent {
  repoId: RepositoryId
  text: string
}

export type ChangeScope = 'worktree' | 'refs'

export interface RepoChangedEvent {
  repoId: RepositoryId
  scopes: ChangeScope[]
}

export interface GitApi {
  status(id: RepositoryId): Promise<Result<GitStatus>>
  branches(id: RepositoryId): Promise<Result<GitBranch[]>>
  remotes(id: RepositoryId): Promise<Result<GitRemote[]>>
  log(id: RepositoryId, options: { skip: number; limit: number }): Promise<Result<GitCommit[]>>
  diff(id: RepositoryId, request: DiffRequest): Promise<Result<FileDiff>>
  commitFiles(id: RepositoryId, hash: string): Promise<Result<ChangedFile[]>>
  stage(id: RepositoryId, files: string[]): Promise<Result<void>>
  stageAll(id: RepositoryId): Promise<Result<void>>
  unstage(id: RepositoryId, files: string[]): Promise<Result<void>>
  unstageAll(id: RepositoryId): Promise<Result<void>>
  discard(id: RepositoryId, files: string[]): Promise<Result<void>>
  deleteUntracked(id: RepositoryId, files: string[]): Promise<Result<void>>
  commit(id: RepositoryId, message: string): Promise<Result<void>>
  checkout(id: RepositoryId, branch: string): Promise<Result<void>>
  checkoutRemote(id: RepositoryId, remoteBranch: string): Promise<Result<void>>
  checkoutCommit(id: RepositoryId, hash: string): Promise<Result<void>>
  createBranch(id: RepositoryId, name: string, startPoint: string | null, checkout: boolean): Promise<Result<void>>
  deleteBranch(id: RepositoryId, name: string, force: boolean): Promise<Result<void>>
  merge(id: RepositoryId, branch: string): Promise<Result<void>>
  fetch(id: RepositoryId): Promise<Result<void>>
  pull(id: RepositoryId): Promise<Result<void>>
  push(id: RepositoryId, setUpstream: boolean): Promise<Result<void>>
  cancel(id: RepositoryId): Promise<Result<void>>
  stashes(id: RepositoryId): Promise<Result<GitStash[]>>
  stash(id: RepositoryId, options: { message: string; includeUntracked: boolean }): Promise<Result<void>>
  stashApply(id: RepositoryId, ref: string): Promise<Result<void>>
  stashPop(id: RepositoryId, ref: string): Promise<Result<void>>
  stashDrop(id: RepositoryId, ref: string): Promise<Result<void>>
  onProgress(listener: (event: ProgressEvent) => void): () => void
}

export interface RepoApi {
  /** data is null when the user cancelled the picker */
  openDialog(): Promise<Result<RepositoryInfo | null>>
  open(path: string): Promise<Result<RepositoryInfo>>
  close(id: RepositoryId): Promise<Result<void>>
  setActive(id: RepositoryId | null): Promise<Result<void>>
  session(): Promise<Result<Session>>
  onChanged(listener: (event: RepoChangedEvent) => void): () => void
}

export interface SystemApi {
  platform: string
  openFile(id: RepositoryId, path: string): Promise<Result<void>>
  reveal(id: RepositoryId, path: string): Promise<Result<void>>
}
