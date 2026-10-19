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

/** multi-step operation waiting for the user (conflicts to resolve, then commit or abort) */
export type RepoOperation = 'merge' | 'cherry-pick' | 'revert' | 'rebase' | 'bisect'

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
  operation: RepoOperation | null
  /** prepared commit message (.git/MERGE_MSG) of a merge / cherry-pick / revert in progress */
  mergeMessage?: string
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

export interface GitTag {
  name: string
  /** commit the tag points to (annotated tags are peeled) */
  hash: string
  message?: string
}

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'

/** One line of an interactive rebase todo, oldest commit first. `message` is the new message for reword. */
export interface RebaseStep {
  hash: string
  action: RebaseAction
  message?: string
}

export interface GitWorktree {
  path: string
  head: string
  /** null when detached */
  branch: string | null
  isMain: boolean
  locked: boolean
  prunable: boolean
}

export interface GitSubmodule {
  path: string
  hash: string
  state: 'ok' | 'uninitialized' | 'modified' | 'conflict'
}

export interface LfsInfo {
  installed: boolean
  version?: string
  patterns: string[]
  /** `downloaded` = full object present (not just the pointer) */
  files: { path: string; downloaded: boolean }[]
}

export interface GitFlowConfig {
  main: string
  develop: string
  feature: string
  release: string
  hotfix: string
  versionTag: string
}

export type FlowKind = 'feature' | 'release' | 'hotfix'

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
  /** commit the stash was made on (its first parent) */
  base: string
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

export interface LogOptions {
  skip: number
  limit: number
  /** message text or commit hash */
  search?: string
  author?: string
  /** only history reachable from this branch/ref (default: all refs) */
  ref?: string
}

export type ResetMode = 'soft' | 'mixed' | 'hard'

export type DiffRequest =
  | { kind: 'working'; path: string; staged: boolean; untracked?: boolean; conflicted?: boolean; ignoreWhitespace?: boolean }
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

export interface BlameCommit {
  hash: string
  author: string
  /** ISO date */
  date: string
  summary: string
}

export interface BlameLine {
  hash: string
  /** line number in the blamed file */
  line: number
  content: string
}

export interface FileBlame {
  lines: BlameLine[]
  commits: Record<string, BlameCommit>
}

export interface AppSettings {
  /** null = `git` from PATH */
  gitPath: string | null
  gitVersion: string
}

export interface GitError {
  operation: string
  exitCode: number
  stdout: string
  stderr: string
  command?: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: GitError }

/** Opening a folder either registers the repository or reports why it is not one. */
export type OpenResult =
  | { repo: RepositoryInfo }
  | {
      notRepository: {
        path: string
        /** repository the folder is inside of (a sub folder was picked), if any */
        root: string | null
        /** only folders picked in the native dialog may be initialized */
        canInit: boolean
      }
    }

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
  log(id: RepositoryId, options: LogOptions): Promise<Result<GitCommit[]>>
  tags(id: RepositoryId): Promise<Result<GitTag[]>>
  diff(id: RepositoryId, request: DiffRequest): Promise<Result<FileDiff>>
  commitFiles(id: RepositoryId, hash: string): Promise<Result<ChangedFile[]>>
  stage(id: RepositoryId, files: string[]): Promise<Result<void>>
  stageAll(id: RepositoryId): Promise<Result<void>>
  unstage(id: RepositoryId, files: string[]): Promise<Result<void>>
  unstageAll(id: RepositoryId): Promise<Result<void>>
  discard(id: RepositoryId, files: string[]): Promise<Result<void>>
  deleteUntracked(id: RepositoryId, files: string[]): Promise<Result<void>>
  commit(id: RepositoryId, message: string, amend: boolean): Promise<Result<void>>
  /** full message of HEAD (to edit when amending) */
  headMessage(id: RepositoryId): Promise<Result<string>>
  blame(id: RepositoryId, path: string, hash: string | null): Promise<Result<FileBlame>>
  checkout(id: RepositoryId, branch: string): Promise<Result<void>>
  checkoutRemote(id: RepositoryId, remoteBranch: string): Promise<Result<void>>
  checkoutCommit(id: RepositoryId, hash: string): Promise<Result<void>>
  createBranch(id: RepositoryId, name: string, startPoint: string | null, checkout: boolean): Promise<Result<void>>
  renameBranch(id: RepositoryId, name: string, newName: string): Promise<Result<void>>
  deleteBranch(id: RepositoryId, name: string, force: boolean): Promise<Result<void>>
  merge(id: RepositoryId, branch: string): Promise<Result<void>>
  rebase(id: RepositoryId, onto: string): Promise<Result<void>>
  rebaseContinue(id: RepositoryId): Promise<Result<void>>
  rebaseSkip(id: RepositoryId): Promise<Result<void>>
  /** commits an interactive rebase onto `base` would rewrite (oldest first) and how many merges get flattened */
  rebaseCommits(id: RepositoryId, base: string): Promise<Result<{ commits: GitCommit[]; merges: number }>>
  interactiveRebase(id: RepositoryId, base: string, steps: RebaseStep[]): Promise<Result<void>>
  /** returns Git's message ("Bisecting: N revisions left…" / "<hash> is the first bad commit") */
  bisectStart(id: RepositoryId, bad: string, good: string): Promise<Result<string>>
  bisectMark(id: RepositoryId, verdict: 'good' | 'bad' | 'skip'): Promise<Result<string>>
  worktrees(id: RepositoryId): Promise<Result<GitWorktree[]>>
  /** asks for the folder with a native dialog; data is null when cancelled */
  addWorktree(id: RepositoryId, branch: string, createBranch: boolean): Promise<Result<string | null>>
  removeWorktree(id: RepositoryId, path: string, force: boolean): Promise<Result<void>>
  pruneWorktrees(id: RepositoryId): Promise<Result<void>>
  submodules(id: RepositoryId): Promise<Result<GitSubmodule[]>>
  updateSubmodules(id: RepositoryId, path?: string): Promise<Result<void>>
  lfs(id: RepositoryId): Promise<Result<LfsInfo>>
  lfsPull(id: RepositoryId): Promise<Result<void>>
  /** null when Git Flow is not initialized */
  gitFlow(id: RepositoryId): Promise<Result<GitFlowConfig | null>>
  gitFlowInit(id: RepositoryId): Promise<Result<void>>
  gitFlowStart(id: RepositoryId, kind: FlowKind, name: string): Promise<Result<void>>
  gitFlowFinish(id: RepositoryId, branch: string): Promise<Result<void>>
  cherryPick(id: RepositoryId, hash: string): Promise<Result<void>>
  revert(id: RepositoryId, hash: string): Promise<Result<void>>
  reset(id: RepositoryId, hash: string, mode: ResetMode): Promise<Result<void>>
  abortOperation(id: RepositoryId): Promise<Result<void>>
  resolveConflict(id: RepositoryId, files: string[], side: 'ours' | 'theirs'): Promise<Result<void>>
  createTag(id: RepositoryId, name: string, hash: string, message: string): Promise<Result<void>>
  deleteTag(id: RepositoryId, name: string): Promise<Result<void>>
  pushTag(id: RepositoryId, name: string): Promise<Result<void>>
  fetch(id: RepositoryId): Promise<Result<void>>
  pull(id: RepositoryId): Promise<Result<void>>
  /** `remote` (with setUpstream) pushes the current branch to that remote instead of origin */
  push(id: RepositoryId, setUpstream: boolean, remote?: string): Promise<Result<void>>
  fetchRemote(id: RepositoryId, remote: string): Promise<Result<void>>
  addRemote(id: RepositoryId, name: string, url: string): Promise<Result<void>>
  removeRemote(id: RepositoryId, name: string): Promise<Result<void>>
  setRemoteUrl(id: RepositoryId, name: string, url: string): Promise<Result<void>>
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
  openDialog(): Promise<Result<OpenResult | null>>
  open(path: string): Promise<Result<OpenResult>>
  /** `git init` in a folder previously reported as notRepository, then opens it */
  init(path: string): Promise<Result<RepositoryInfo>>
  close(id: RepositoryId): Promise<Result<void>>
  setActive(id: RepositoryId | null): Promise<Result<void>>
  /** tab order, remembered for the next session */
  setOrder(ids: RepositoryId[]): Promise<Result<void>>
  session(): Promise<Result<Session>>
  onChanged(listener: (event: RepoChangedEvent) => void): () => void
}

export interface SystemApi {
  platform: string
  openFile(id: RepositoryId, path: string): Promise<Result<void>>
  reveal(id: RepositoryId, path: string): Promise<Result<void>>
  /** opens the repository (or one of its files, at `line`) in VS Code */
  openInEditor(id: RepositoryId, path?: string, line?: number): Promise<Result<void>>
  openTerminal(id: RepositoryId): Promise<Result<void>>
  openFolder(id: RepositoryId): Promise<Result<void>>
  settings(): Promise<Result<AppSettings>>
  /** native file picker; the chosen file must answer `--version` like Git */
  pickGitExecutable(): Promise<Result<AppSettings | null>>
  resetGitExecutable(): Promise<Result<AppSettings>>
}
